// Lot 272 — effets d'une décision de modération, partagés entre la route admin (décision humaine) et la
// publication automatique (src/lib/auto-publish.ts). Avant ce lot, tout vivait dans la route
// /api/admin/listings/[id]/moderate ; la règle automatique devait produire EXACTEMENT les mêmes effets
// (date d'expiration à la première publication, courriel + notification au vendeur, alertes de recherche,
// abonnés du compte pro), d'où l'extraction.
import type { ListingFormula } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";
import { notifyUser } from "@/lib/notify-user";
import { notifyMatchingSearchAlerts } from "@/lib/search-alerts";
import { notifyProFollowers } from "@/lib/pro-follow";
import { computeExpiryDate } from "@/lib/listing-lifecycle";
import { formulaValidityDays } from "@/lib/payment-orders";

export type ModerationOutcome = "approve" | "reject" | "suspend";

// Champs à écrire sur l'annonce pour une publication (première ou nouvelle, humaine ou automatique).
// Lot 265 (audit A2) — la PREMIÈRE publication fixe la date d'expiration (publishedAt + durée de la
// formule) ; une ré-approbation après modification garde le cycle en cours. `autoPublishedAt` trace qui
// a décidé : la règle (date) ou un humain (null) — une ré-approbation humaine efface la trace automatique.
export function publicationData(
  listing: { publishedAt: Date | null; formula: ListingFormula },
  now: Date,
  options: { auto: boolean }
) {
  const firstPublication = !listing.publishedAt;
  return {
    status: "PUBLIEE" as const,
    moderationNote: null,
    publishedAt: firstPublication ? now : listing.publishedAt,
    autoPublishedAt: options.auto ? now : null,
    ...(firstPublication
      ? { expiresAt: computeExpiryDate(now, formulaValidityDays(listing.formula)), expiryReminderSentAt: null }
      : {}),
  };
}

type Translate = (key: string, values?: Record<string, string>) => string;

// Courriel au vendeur selon l'issue (texte déjà traduit dans sa langue). Pur : testable sans Prisma.
export function buildModerationEmail(
  t: Translate,
  input: { outcome: ModerationOutcome; title: string; reason?: string | null; listingId: string; locale: string }
): { subject: string; html: string; url: string } {
  const title = escapeHtml(input.title);
  const reason = escapeHtml(input.reason?.trim() ?? "");
  const listingUrl = `/${input.locale}/annonce/${input.listingId}`;
  const myListingsUrl = `/${input.locale}/compte/mes-annonces`;

  if (input.outcome === "approve") {
    return {
      subject: t("listingApprovedSubject"),
      html: `<p>${t("greeting")}</p><p>${t("listingApprovedBody", { title })}</p><p><a href="${SITE_URL}${listingUrl}">${t("listingApprovedLink")}</a></p>`,
      url: listingUrl,
    };
  }
  if (input.outcome === "reject") {
    return {
      subject: t("listingRejectedSubject"),
      html: `<p>${t("greeting")}</p><p>${t("listingRejectedBody", { title, reason })}</p><p><a href="${SITE_URL}${myListingsUrl}">${t("listingRejectedLink")}</a></p>`,
      url: myListingsUrl,
    };
  }
  return {
    subject: t("listingSuspendedSubject"),
    html: `<p>${t("greeting")}</p><p>${t("listingSuspendedBody", { title, reason })}</p><p><a href="${SITE_URL}${myListingsUrl}">${t("listingSuspendedLink")}</a></p>`,
    url: myListingsUrl,
  };
}

const NOTIFICATION_KIND = {
  approve: "LISTING_APPROVED",
  reject: "LISTING_REJECTED",
  suspend: "LISTING_SUSPENDED",
} as const;

// Courriel + notification in-app au vendeur. Ne lève jamais (notifyUser est « au mieux »).
export async function notifySellerOfModeration(input: {
  listing: { id: string; sellerId: string; title: string };
  outcome: ModerationOutcome;
  reason?: string | null;
}): Promise<void> {
  const seller = await prisma.user.findUnique({ where: { id: input.listing.sellerId } });
  if (!seller) return;

  const t = await getTranslations({ locale: seller.locale, namespace: "Notifications" });
  const email = buildModerationEmail(t, {
    outcome: input.outcome,
    title: input.listing.title,
    reason: input.reason,
    listingId: input.listing.id,
    locale: seller.locale,
  });

  await notifyUser({
    userId: input.listing.sellerId,
    kind: NOTIFICATION_KIND[input.outcome],
    url: email.url,
    body: input.listing.title,
    email: { tag: "modération annonce", to: seller.email, subject: email.subject, html: email.html },
  });
}

// Une annonce vient d'être publiée : alertes de recherche (une requête par alerte) et abonnés du compte pro.
// Lot 268 (audit B5) — à appeler APRÈS la réponse HTTP (after()) ou depuis une tâche de fond, jamais dans
// la requête d'un modérateur.
export async function broadcastPublication(
  listing: Parameters<typeof notifyMatchingSearchAlerts>[0]
): Promise<void> {
  await notifyMatchingSearchAlerts(listing).catch((err) =>
    console.error(`[alertes recherche] ${(err as Error).message}`)
  );
  await notifyProFollowers({ id: listing.id, title: listing.title, sellerId: listing.sellerId });
}
