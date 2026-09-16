import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { isEligibleForAutoRenewal, computeExpiryDate } from "@/lib/listing-lifecycle";
import { effectiveTier, hasAdvancedProTools } from "@/lib/pro-subscription";
import { SITE_URL } from "@/lib/site";

// Lot 82 — même principe de balayage paresseux que l'expiration elle-même
// (aucun scheduler dans cette application, cf. listing-expiry-sweep.ts) :
// appelé AVANT sweepExpiredListings aux mêmes points d'entrée, pour intercepter
// une annonce éligible avant qu'elle ne soit basculée en EXPIREE. Une borne
// (`take`) protège contre un balayage qui grossirait sans limite.
const MAX_AUTO_RENEWALS_PER_SWEEP = 50;

export async function sweepAutoRenewals(now: Date = new Date()): Promise<void> {
  // orderBy par expiration la plus ancienne (Lot 98, audit sécurité/qualité)
  // — même raisonnement que sweepExpiringListingsForReminders : sans lui, le
  // `take` échantillonne arbitrairement dès que plus de
  // MAX_AUTO_RENEWALS_PER_SWEEP annonces sont expirées en même temps.
  const candidates = await prisma.listing.findMany({
    where: { status: "PUBLIEE", autoRenew: true, expiresAt: { lt: now } },
    include: { seller: { include: { professionalAccount: { include: { subscription: true } } } } },
    orderBy: { expiresAt: "asc" },
    take: MAX_AUTO_RENEWALS_PER_SWEEP,
  });

  for (const listing of candidates) {
    const account = listing.seller.professionalAccount;
    // Jamais un particulier : le renouvellement automatique est un outil
    // Pro/Premium, réservé aux comptes professionnels (§4-B).
    if (!account) continue;

    const tier = effectiveTier(account.subscription?.tier ?? "STARTER", account.subscription?.expiresAt ?? null, now);
    const eligible = isEligibleForAutoRenewal({
      status: listing.status,
      autoRenew: listing.autoRenew,
      expiresAt: listing.expiresAt,
      sellerHasAdvancedTools: hasAdvancedProTools(tier),
      now,
    });
    if (!eligible) continue;

    const newExpiresAt = computeExpiryDate(now);

    // Marquage atomique avant les effets de bord : si deux visites concurrentes
    // déclenchent le balayage sur la même annonce, seule celle dont l'update
    // "gagne" la course (expiresAt encore égal à la valeur lue) la renouvelle
    // réellement — même discipline que sweepExpiringListingsForReminders.
    const claim = await prisma.listing.updateMany({
      where: { id: listing.id, status: "PUBLIEE", expiresAt: listing.expiresAt },
      data: { expiresAt: newExpiresAt, publishedAt: now, expiryReminderSentAt: null },
    });
    if (claim.count === 0) continue;

    await prisma.listingRenewal.create({
      data: { listingId: listing.id, renewedAt: now, expiresAt: newExpiresAt },
    });

    const t = await getTranslations({ locale: listing.seller.locale, namespace: "Notifications" });
    const emailResult = await sendEmail({
      to: listing.seller.email,
      subject: t("autoRenewedSubject"),
      html: `<p>${t("greeting")}</p><p>${t("autoRenewedBody", {
        title: escapeHtml(listing.title),
        date: new Intl.DateTimeFormat(listing.seller.locale === "ar" ? "ar-DZ" : "fr-DZ", {
          dateStyle: "long",
        }).format(newExpiresAt),
      })}</p><p><a href="${SITE_URL}/${listing.seller.locale}/annonce/${listing.id}">${t(
        "autoRenewedLink"
      )}</a></p>`,
    }).catch((err) => {
      console.error(`[EMAIL renouvellement auto] échec envoi: ${(err as Error).message}`);
      return null;
    });
    if (emailResult?.previewUrl) {
      console.log(`[EMAIL renouvellement auto] ${emailResult.previewUrl}`);
    }
  }
}
