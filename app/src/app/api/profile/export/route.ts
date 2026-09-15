import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";

// Droit d'accès/portabilité des données (RGPD art. 15/20) — complète le droit
// à l'oubli déjà couvert par la suppression de compte (Lot 51). Pertinent
// même pour un site en .dz : l'hébergement prévu en France y soumet les
// données malgré l'extension du domaine (cf. mémoire de session Lot 52/54).
// N'inclut jamais les octets bruts d'un document d'identité (juste son statut
// et ses dates) ni les données propres à un AUTRE utilisateur (signalements
// reçus, comptes qui ont bloqué cet utilisateur) — seule la donnée dont cet
// utilisateur est l'auteur ou qu'il peut déjà consulter dans l'application
// (le contenu d'une conversation à laquelle il participe) est exportée.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`profile-export:${user.id}`, { limit: 5, windowMs: 24 * 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const [
    listings,
    favorites,
    conversations,
    reviewsWritten,
    reviewsReceived,
    reportsAuthored,
    blocksInitiated,
    identityRequests,
    proCollaborations,
  ] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId: user.id },
      include: {
        photos: true,
        priceHistory: true,
        renewals: true,
        brand: true,
        model: true,
        wilaya: true,
        commune: true,
        generation: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.favorite.findMany({
      where: { userId: user.id },
      include: { listing: { select: { id: true, title: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.conversation.findMany({
      where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
      include: {
        listing: { select: { id: true, title: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.review.findMany({ where: { authorId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.review.findMany({ where: { sellerId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.report.findMany({ where: { authorId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.block.findMany({
      where: { blockerId: user.id },
      include: { blocked: { select: { email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.identityVerificationRequest.findMany({
      where: { userId: user.id },
      select: { status: true, documentMime: true, reviewNote: true, createdAt: true, reviewedAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.proCollaborator.findMany({
      where: { userId: user.id },
      include: { professionalAccount: { select: { nomCommercial: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const data = {
    exporteLe: new Date().toISOString(),
    compte: {
      id: user.id,
      email: user.email,
      telephone: user.phone,
      role: user.role,
      langue: user.locale,
      creeLe: user.createdAt,
      emailVerifieLe: user.emailVerifiedAt,
      telephoneVerifieLe: user.phoneVerifiedAt,
      identiteVerifieeLe: user.identityVerifiedAt,
      profil: user.profile
        ? {
            nomAffiche: user.profile.displayName,
            bio: user.profile.bio,
            avatarUrl: user.profile.avatarUrl,
            wilaya: user.profile.wilaya?.nomFr ?? null,
          }
        : null,
    },
    compteProfessionnel: user.professionalAccount
      ? {
          nomCommercial: user.professionalAccount.nomCommercial,
          presentation: user.professionalAccount.presentation,
          horaires: user.professionalAccount.horaires,
          badgeVerifie: user.professionalAccount.badgeVerifie,
          creeLe: user.professionalAccount.createdAt,
        }
      : null,
    collaborationsProfessionnelles: proCollaborations.map((c) => ({
      compteProfessionnel: c.professionalAccount.nomCommercial,
      permissions: JSON.parse(c.permissions),
      depuisLe: c.createdAt,
    })),
    annonces: listings.map((l) => ({
      id: l.id,
      titre: l.title,
      description: l.description,
      prix: l.price,
      marque: l.brand?.name ?? l.brandFreeText,
      modele: l.model?.name ?? l.modelFreeText,
      annee: l.year,
      kilometrage: l.mileage,
      statut: l.status,
      wilaya: l.wilaya.nomFr,
      commune: l.commune?.nomFr ?? null,
      generation: l.generation?.name ?? null,
      vues: l.views,
      creeLe: l.createdAt,
      publieeLe: l.publishedAt,
      expireLe: l.expiresAt,
      photos: l.photos.map((p) => p.path),
      historiquePrix: l.priceHistory.map((h) => ({ prix: h.price, enregistreLe: h.recordedAt })),
      renouvellements: l.renewals.map((r) => ({ renouveleLe: r.renewedAt, expireLe: r.expiresAt })),
    })),
    favoris: favorites.map((f) => ({
      annonceId: f.listingId,
      annonceTitre: f.listing.title,
      ajouteLe: f.createdAt,
    })),
    conversations: conversations.map((c) => ({
      annonceId: c.listingId,
      annonceTitre: c.listing.title,
      role: c.buyerId === user.id ? "acheteur" : "vendeur",
      demarreeLe: c.createdAt,
      messages: c.messages.map((m) => ({
        auteur: m.senderId === user.id ? "moi" : "autre_partie",
        contenu: m.content,
        pieceJointe: m.attachmentUrl,
        envoyeLe: m.createdAt,
        luLe: m.readAt,
        supprimeLe: m.deletedAt,
      })),
    })),
    avisRediges: reviewsWritten.map((r) => ({
      note: r.rating,
      commentaire: r.comment,
      redigeLe: r.createdAt,
    })),
    avisRecus: reviewsReceived.map((r) => ({
      note: r.rating,
      commentaire: r.comment,
      reponse: r.reply,
      recuLe: r.createdAt,
    })),
    signalementsEffectues: reportsAuthored.map((r) => ({
      cible: r.listingId ? "annonce" : "utilisateur",
      motif: r.reason,
      commentaire: r.comment,
      statut: r.status,
      effectueLe: r.createdAt,
    })),
    comptesBloques: blocksInitiated.map((b) => ({ email: b.blocked.email, bloqueLe: b.createdAt })),
    demandesVerificationIdentite: identityRequests.map((d) => ({
      statut: d.status,
      typeDocument: d.documentMime,
      note: d.reviewNote,
      soumiseLe: d.createdAt,
      traiteeLe: d.reviewedAt,
    })),
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="souq-auto-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
