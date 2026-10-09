// Lot 272 — modération à deux vitesses.
//
// Une annonce qui ne présente AUCUN signal est publiée sans attendre un modérateur, à condition que son
// vendeur ait déjà été approuvé par un humain (au moins N fois, réglable) et n'ait aucun incident. Tout le
// reste — première annonce d'un compte, signal anti-fraude, soupçon IA, photo de mauvaise qualité, vendeur
// déjà refusé/suspendu/signalé — reste dans la file humaine, inchangée. La règle est désactivée par défaut
// (réglage « Publication automatique » dans /admin/parametres, réservé aux ADMIN).
//
// La décision (decideAutoPublish) est pure et exhaustive : chaque refus donne TOUS ses motifs, journalisés,
// pour qu'on puisse comprendre après coup pourquoi une annonce a attendu.
import type { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getModerationSettings } from "@/lib/moderation-settings";
import { writeAuditLog } from "@/lib/audit-log";
import { broadcastPublication, notifySellerOfModeration, publicationData } from "@/lib/listing-publication";

export type AutoPublishBlocker =
  | "disabled"
  | "not_pending"
  | "fraud_not_checked"
  | "fraud_signals"
  | "ai_not_checked"
  | "ai_suspicion"
  | "photo_quality"
  | "seller_history"
  | "seller_incidents";

export type AutoPublishInput = {
  settings: { autoPublishEnabled: boolean; autoPublishMinApprovedListings: number };
  listing: {
    status: ListingStatus;
    fraudCheckedAt: Date | null;
    fraudScore: number;
    aiCheckedAt: Date | null;
    aiSuspicion: string | null;
    photoQualityFlags: string[];
  };
  // Clé Anthropic présente : l'analyse IA fait alors partie des contrôles exigés avant publication.
  aiConfigured: boolean;
  seller: {
    // Annonces de ce vendeur publiées par un HUMAIN (jamais par la règle : pas d'effet boule de neige).
    humanApprovedCount: number;
    // Annonces refusées ou suspendues + signalements confirmés contre lui ou ses annonces.
    incidentCount: number;
  };
};

export type AutoPublishDecision = { publish: true } | { publish: false; blockers: AutoPublishBlocker[] };

export function decideAutoPublish(input: AutoPublishInput): AutoPublishDecision {
  if (!input.settings.autoPublishEnabled) return { publish: false, blockers: ["disabled"] };

  const blockers: AutoPublishBlocker[] = [];
  const { listing, seller } = input;

  if (listing.status !== "EN_ATTENTE") blockers.push("not_pending");
  if (!listing.fraudCheckedAt) blockers.push("fraud_not_checked");
  else if (listing.fraudScore > 0) blockers.push("fraud_signals");
  if (input.aiConfigured && !listing.aiCheckedAt) blockers.push("ai_not_checked");
  if (listing.aiSuspicion) blockers.push("ai_suspicion");
  if (listing.photoQualityFlags.length > 0) blockers.push("photo_quality");
  if (seller.humanApprovedCount < input.settings.autoPublishMinApprovedListings) blockers.push("seller_history");
  if (seller.incidentCount > 0) blockers.push("seller_incidents");

  return blockers.length === 0 ? { publish: true } : { publish: false, blockers };
}

function parseQualityFlags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export type AutoPublishResult =
  | AutoPublishDecision
  | { publish: false; blockers: ["not_found"] | ["race_lost"] | ["error"] };

// À appeler APRÈS le calcul du score anti-fraude et l'analyse IA (même chaîne after() que la soumission).
// Ne lève jamais : un échec ici laisse simplement l'annonce dans la file humaine.
export async function tryAutoPublish(listingId: string, now: Date = new Date()): Promise<AutoPublishResult> {
  try {
    const settings = await getModerationSettings();
    if (!settings.autoPublishEnabled) return { publish: false, blockers: ["disabled"] };

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { photos: { select: { qualityFlags: true } } },
    });
    if (!listing) return { publish: false, blockers: ["not_found"] };

    const [humanApprovedCount, incidentListings, incidentReports] = await Promise.all([
      prisma.listing.count({
        where: {
          sellerId: listing.sellerId,
          id: { not: listing.id },
          publishedAt: { not: null },
          autoPublishedAt: null,
          status: { in: ["PUBLIEE", "VENDUE", "EXPIREE"] },
        },
      }),
      prisma.listing.count({ where: { sellerId: listing.sellerId, status: { in: ["REFUSEE", "SUSPENDUE"] } } }),
      prisma.report.count({
        where: {
          status: "TRAITE",
          OR: [{ reportedUserId: listing.sellerId }, { listing: { sellerId: listing.sellerId } }],
        },
      }),
    ]);

    const decision = decideAutoPublish({
      settings,
      listing: {
        status: listing.status,
        fraudCheckedAt: listing.fraudCheckedAt,
        fraudScore: listing.fraudScore,
        aiCheckedAt: listing.aiCheckedAt,
        aiSuspicion: listing.aiSuspicion,
        photoQualityFlags: listing.photos.flatMap((p) => parseQualityFlags(p.qualityFlags)),
      },
      aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      seller: { humanApprovedCount, incidentCount: incidentListings + incidentReports },
    });

    if (!decision.publish) {
      console.info(`[auto-publish] annonce ${listingId} laissée en modération : ${decision.blockers.join(", ")}`);
      return decision;
    }

    // Un modérateur a pu trancher entre-temps : `updateMany` filtré sur EN_ATTENTE est atomique.
    const data = publicationData(listing, now, { auto: true });
    const { count } = await prisma.listing.updateMany({ where: { id: listingId, status: "EN_ATTENTE" }, data });
    if (count === 0) return { publish: false, blockers: ["race_lost"] };

    const published = { ...listing, ...data };
    await notifySellerOfModeration({ listing: published, outcome: "approve" });
    await broadcastPublication(published);
    await writeAuditLog({
      adminId: null,
      action: "listing.auto_publish",
      targetType: "Listing",
      targetId: listingId,
      details: {
        previousStatus: "EN_ATTENTE",
        newStatus: "PUBLIEE",
        humanApprovedCount,
        minRequired: settings.autoPublishMinApprovedListings,
      },
    });
    console.info(`[auto-publish] annonce ${listingId} publiée automatiquement`);
    return decision;
  } catch (err) {
    console.error(`[auto-publish] échec pour ${listingId} : ${(err as Error).message}`);
    return { publish: false, blockers: ["error"] };
  }
}
