// Lot 297 — rappels d'expiration des documents du véhicule (assurance et contrôle
// technique). Balayé dans le cron nightly aux côtés des autres sweepers. Le seuil
// de rappel est de 30 jours avant la date d'expiration du document ; un seul rappel
// par document, par cycle (le champ de suivi est remis à null si le vendeur met
// à jour la date d'expiration correspondante via PATCH /api/listings/[id]).
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify-user";
import { escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";
import type { NotificationKind } from "@prisma/client";

const MAX_PER_SWEEP = 50;
export const REMINDER_DAYS = 30;

type DocumentField = "assuranceExpiry" | "controltechniqueExpiry";
type ReminderSentField = "assuranceExpiryReminderSentAt" | "ctExpiryReminderSentAt";

const DOCUMENT_CONFIGS: {
  dateField: DocumentField;
  sentField: ReminderSentField;
  kind: NotificationKind;
  i18nSubjectKey: string;
  i18nBodyKey: string;
  i18nBodyShortKey: string;
  emailTag: string;
}[] = [
  {
    dateField: "assuranceExpiry",
    sentField: "assuranceExpiryReminderSentAt",
    kind: "ASSURANCE_EXPIRING",
    i18nSubjectKey: "assuranceExpirySubject",
    i18nBodyKey: "assuranceExpiryBody",
    i18nBodyShortKey: "assuranceExpiryBodyShort",
    emailTag: "rappel assurance",
  },
  {
    dateField: "controltechniqueExpiry",
    sentField: "ctExpiryReminderSentAt",
    kind: "CT_EXPIRING",
    i18nSubjectKey: "ctExpirySubject",
    i18nBodyKey: "ctExpiryBody",
    i18nBodyShortKey: "ctExpiryBodyShort",
    emailTag: "rappel CT",
  },
];

function dateLabel(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "long" }).format(date);
}

export async function sweepDocumentExpiryReminders(
  now: Date = new Date(),
): Promise<{ assurance: number; ct: number }> {
  const stats = { assurance: 0, ct: 0 };
  const horizon = new Date(now.getTime() + REMINDER_DAYS * 24 * 60 * 60 * 1000);

  for (const config of DOCUMENT_CONFIGS) {
    const candidates = await prisma.listing.findMany({
      where: {
        status: "PUBLIEE",
        [config.dateField]: { gt: now, lte: horizon },
        [config.sentField]: null,
      },
      include: { seller: { select: { id: true, email: true, locale: true } } },
      orderBy: { [config.dateField]: "asc" },
      take: MAX_PER_SWEEP,
    });

    for (const listing of candidates) {
      const claim = await prisma.listing.updateMany({
        where: { id: listing.id, [config.sentField]: null },
        data: { [config.sentField]: now },
      });
      if (claim.count === 0) continue;

      const locale = listing.seller.locale;
      const t = await getTranslations({ locale, namespace: "Notifications" });
      const expiryDate = (listing[config.dateField] as Date)!;
      const values = { title: listing.title, date: dateLabel(expiryDate, locale) };
      const url = `/${locale}/annonce/${listing.id}`;

      await notifyUser({
        userId: listing.seller.id,
        kind: config.kind,
        url,
        body: t(config.i18nBodyShortKey, values),
        email: {
          tag: config.emailTag,
          to: listing.seller.email,
          subject: t(config.i18nSubjectKey),
          html: `<p>${t("greeting")}</p><p>${t(config.i18nBodyKey, { ...values, title: escapeHtml(listing.title) })}</p><p><a href="${SITE_URL}${url}">${t("documentExpiryLink")}</a></p>`,
        },
        push: {
          title: t(config.i18nSubjectKey),
          body: t(config.i18nBodyShortKey, values),
          tag: config.emailTag,
          lang: locale as "fr" | "ar",
        },
      });

      if (config.dateField === "assuranceExpiry") stats.assurance++;
      else stats.ct++;
    }
  }

  return stats;
}
