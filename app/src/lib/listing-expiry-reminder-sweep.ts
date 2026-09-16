import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { shouldSendExpiryReminder } from "@/lib/listing-lifecycle";
import { SITE_URL } from "@/lib/site";

// Aucun planificateur (cron/queue) n'existe dans cette application — comme
// l'expiration elle-même (cf. listing-expiry-sweep.ts), le rappel est balayé
// paresseusement juste avant les lectures à fort trafic. Une borne (`take`)
// protège contre un balayage qui grossirait sans limite si beaucoup
// d'annonces entraient dans la fenêtre de rappel en même temps.
const MAX_REMINDERS_PER_SWEEP = 50;

export async function sweepExpiringListingsForReminders(now: Date = new Date()): Promise<void> {
  // orderBy indispensable ici (Lot 98, audit sécurité/qualité) : sans lui, le
  // `take` échantillonne un sous-ensemble arbitraire de l'ordre par défaut de
  // la base dès que plus de MAX_REMINDERS_PER_SWEEP annonces sont éligibles —
  // une annonce dont la fenêtre de rappel vient de s'ouvrir pourrait alors ne
  // jamais être tirée, aucun email de rappel jamais envoyé. Trier par
  // expiration la plus proche garantit que les annonces qui en ont le plus
  // besoin sont toujours traitées en premier.
  const candidates = await prisma.listing.findMany({
    where: { status: "PUBLIEE", expiryReminderSentAt: null, expiresAt: { not: null } },
    include: { seller: true },
    orderBy: { expiresAt: "asc" },
    take: MAX_REMINDERS_PER_SWEEP,
  });

  for (const listing of candidates) {
    if (
      !shouldSendExpiryReminder({
        expiresAt: listing.expiresAt,
        reminderSentAt: listing.expiryReminderSentAt,
        now,
      })
    ) {
      continue;
    }

    // Marquage atomique avant l'envoi : si deux visites concurrentes
    // déclenchent le balayage sur la même annonce, seule celle dont l'update
    // "gagne" la course (expiryReminderSentAt encore null à cet instant)
    // envoie réellement l'email — jamais de double envoi.
    const claim = await prisma.listing.updateMany({
      where: { id: listing.id, expiryReminderSentAt: null },
      data: { expiryReminderSentAt: now },
    });
    if (claim.count === 0) continue;

    const t = await getTranslations({ locale: listing.seller.locale, namespace: "Notifications" });
    const emailResult = await sendEmail({
      to: listing.seller.email,
      subject: t("expiryReminderSubject"),
      html: `<p>${t("greeting")}</p><p>${t("expiryReminderBody", {
        title: escapeHtml(listing.title),
        date: new Intl.DateTimeFormat(listing.seller.locale === "ar" ? "ar-DZ" : "fr-DZ", {
          dateStyle: "long",
        }).format(listing.expiresAt!),
      })}</p><p><a href="${SITE_URL}/${listing.seller.locale}/annonce/${listing.id}">${t(
        "expiryReminderLink"
      )}</a></p>`,
    }).catch((err) => {
      console.error(`[EMAIL rappel expiration] échec envoi: ${(err as Error).message}`);
      return null;
    });
    if (emailResult?.previewUrl) {
      console.log(`[EMAIL rappel expiration] ${emailResult.previewUrl}`);
    }
  }
}
