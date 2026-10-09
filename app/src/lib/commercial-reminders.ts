// Lot 274 — relances commerciales automatiques, exécutées par le balayage nocturne (/api/cron/sweep).
//
// 1. Virement attendu : une commande (formule d'annonce ou palier pro) payée par virement et toujours EN_ATTENTE
//    deux jours après sa création reçoit UNE relance avec les coordonnées bancaires et la référence à indiquer.
// 2. Abonnement pro qui expire : un rappel à 15 jours, un second à 3 jours, avec le lien de renouvellement ;
//    chaque activation (payment-fulfillment) remet les deux marqueurs à null pour le cycle suivant.
//
// Même discipline que les autres balayages : lot borné, tri par urgence, marquage atomique AVANT l'envoi (jamais
// de double relance si deux passes se chevauchent), un échec n'interrompt pas la passe.
import type { ListingFormula, ProSubscriptionTier } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { escapeHtml, sendEmailBestEffort } from "@/lib/mailer";
import { notifyUser } from "@/lib/notify-user";
import { getPaymentSettings } from "@/lib/payment-settings";
import { formatNumber } from "@/lib/format";
import { SITE_URL } from "@/lib/site";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PER_SWEEP = 50;

export const TRANSFER_REMINDER_AFTER_DAYS = 2;
export const SUBSCRIPTION_REMINDER_DAYS = { first: 15, last: 3 } as const;

// Pur : une commande par virement mérite-t-elle sa relance ?
export function transferReminderDue(input: { createdAt: Date; reminderSentAt: Date | null; now: Date }): boolean {
  if (input.reminderSentAt) return false;
  return input.now.getTime() - input.createdAt.getTime() >= TRANSFER_REMINDER_AFTER_DAYS * DAY_MS;
}

// Pur : quel rappel d'expiration envoyer maintenant (15, 3) ou aucun. Un abonnement déjà expiré n'est pas rappelé
// (il retombe sur Starter, cf. effectiveTier) ; si le rappel à 15 j a été manqué et qu'on est déjà sous 3 j, seul
// celui à 3 j part (le balayage marque alors les deux).
export function subscriptionReminderDue(input: {
  expiresAt: Date | null;
  reminder15SentAt: Date | null;
  reminder3SentAt: Date | null;
  now: Date;
}): 15 | 3 | null {
  if (!input.expiresAt || input.expiresAt.getTime() <= input.now.getTime()) return null;
  const daysLeft = (input.expiresAt.getTime() - input.now.getTime()) / DAY_MS;
  if (daysLeft <= SUBSCRIPTION_REMINDER_DAYS.last) return input.reminder3SentAt ? null : 3;
  if (daysLeft <= SUBSCRIPTION_REMINDER_DAYS.first) return input.reminder15SentAt ? null : 15;
  return null;
}

// Noms commerciaux, identiques dans les deux langues.
const FORMULA_LABEL: Record<ListingFormula, string> = { STANDARD: "Standard", PREMIUM: "Premium", PREMIUM_PLUS: "Premium+" };
const TIER_LABEL: Record<ProSubscriptionTier, string> = { STARTER: "Starter", BUSINESS: "Business", PRO: "Pro", PREMIUM: "Premium" };

function dateLabel(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "long" }).format(date);
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

async function bankLine(t: Translate, reference: string): Promise<string> {
  const settings = await getPaymentSettings();
  if (!settings.bankName || !settings.bankRib || !settings.bankAccountHolder) return "";
  return `<p>${t("transferReminderBank", {
    bankName: escapeHtml(settings.bankName),
    rib: escapeHtml(settings.bankRib),
    holder: escapeHtml(settings.bankAccountHolder),
    reference: escapeHtml(reference),
  })}</p>`;
}

export type TransferReminderStats = { listingOrders: number; subscriptionOrders: number };

export async function sweepPendingTransferReminders(now: Date = new Date()): Promise<TransferReminderStats> {
  const stats: TransferReminderStats = { listingOrders: 0, subscriptionOrders: 0 };
  const pending = { provider: "VIREMENT" as const, status: "EN_ATTENTE" as const, reminderSentAt: null };

  // Formules d'annonce.
  const listingOrders = await prisma.paymentOrder.findMany({
    where: pending,
    orderBy: { createdAt: "asc" },
    take: MAX_PER_SWEEP,
    include: { user: { select: { email: true, locale: true } }, listing: { select: { title: true } } },
  });
  for (const order of listingOrders) {
    if (!transferReminderDue({ createdAt: order.createdAt, reminderSentAt: order.reminderSentAt, now })) continue;
    const claim = await prisma.paymentOrder.updateMany({ where: { id: order.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (claim.count === 0) continue;

    const locale = order.user.locale;
    const t = await getTranslations({ locale, namespace: "Notifications" });
    const html =
      `<p>${t("greeting")}</p><p>${t("transferReminderListingBody", {
        formula: FORMULA_LABEL[order.formula],
        title: escapeHtml(order.listing.title),
        reference: escapeHtml(order.reference),
        amount: formatNumber(order.amountDzd, locale),
        date: dateLabel(order.createdAt, locale),
      })}</p>` +
      (await bankLine(t, order.reference)) +
      `<p>${t("transferReminderIgnore")}</p><p><a href="${SITE_URL}/${locale}/compte/mes-annonces">${t("transferReminderListingLink")}</a></p>`;
    await sendEmailBestEffort(`relance virement ${order.reference}`, { to: order.user.email, subject: t("transferReminderSubject"), html });
    stats.listingOrders++;
  }

  // Paliers pro.
  const subscriptionOrders = await prisma.proSubscriptionOrder.findMany({
    where: pending,
    orderBy: { createdAt: "asc" },
    take: MAX_PER_SWEEP,
    include: { user: { select: { email: true, locale: true } }, professionalAccount: { select: { nomCommercial: true } } },
  });
  for (const order of subscriptionOrders) {
    if (!transferReminderDue({ createdAt: order.createdAt, reminderSentAt: order.reminderSentAt, now })) continue;
    const claim = await prisma.proSubscriptionOrder.updateMany({ where: { id: order.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (claim.count === 0) continue;

    const locale = order.user.locale;
    const t = await getTranslations({ locale, namespace: "Notifications" });
    const html =
      `<p>${t("greeting")}</p><p>${t("transferReminderSubscriptionBody", {
        tier: TIER_LABEL[order.tier],
        accountName: escapeHtml(order.professionalAccount.nomCommercial),
        reference: escapeHtml(order.reference),
        amount: formatNumber(order.amountDzd, locale),
        date: dateLabel(order.createdAt, locale),
      })}</p>` +
      (await bankLine(t, order.reference)) +
      `<p>${t("transferReminderIgnore")}</p><p><a href="${SITE_URL}/${locale}/pro/tableau-de-bord">${t("transferReminderSubscriptionLink")}</a></p>`;
    await sendEmailBestEffort(`relance virement ${order.reference}`, { to: order.user.email, subject: t("transferReminderSubject"), html });
    stats.subscriptionOrders++;
  }

  return stats;
}

export type SubscriptionReminderStats = { first: number; last: number };

export async function sweepSubscriptionExpiryReminders(now: Date = new Date()): Promise<SubscriptionReminderStats> {
  const stats: SubscriptionReminderStats = { first: 0, last: 0 };
  const horizon = new Date(now.getTime() + SUBSCRIPTION_REMINDER_DAYS.first * DAY_MS);

  const candidates = await prisma.proSubscription.findMany({
    where: {
      tier: { not: "STARTER" },
      expiresAt: { gt: now, lte: horizon },
      OR: [{ reminder15SentAt: null }, { reminder3SentAt: null }],
    },
    orderBy: { expiresAt: "asc" },
    take: MAX_PER_SWEEP,
    include: { professionalAccount: { select: { nomCommercial: true, user: { select: { id: true, email: true, locale: true } } } } },
  });

  for (const sub of candidates) {
    const due = subscriptionReminderDue({ expiresAt: sub.expiresAt, reminder15SentAt: sub.reminder15SentAt, reminder3SentAt: sub.reminder3SentAt, now });
    if (!due) continue;

    const claim =
      due === 15
        ? await prisma.proSubscription.updateMany({ where: { id: sub.id, reminder15SentAt: null }, data: { reminder15SentAt: now } })
        : await prisma.proSubscription.updateMany({
            where: { id: sub.id, reminder3SentAt: null },
            data: { reminder3SentAt: now, reminder15SentAt: sub.reminder15SentAt ?? now },
          });
    if (claim.count === 0) continue;

    const { user, nomCommercial } = sub.professionalAccount;
    const locale = user.locale;
    const t = await getTranslations({ locale, namespace: "Notifications" });
    const values = { tier: TIER_LABEL[sub.tier], accountName: nomCommercial, days: due, date: dateLabel(sub.expiresAt!, locale) };
    const url = `/${locale}/pro/tableau-de-bord`;

    await notifyUser({
      userId: user.id,
      kind: "SUBSCRIPTION_EXPIRING",
      url,
      body: t("subscriptionExpiringBodyShort", values),
      email: {
        tag: `rappel abonnement ${nomCommercial}`,
        to: user.email,
        subject: t("subscriptionExpiringSubject", values),
        html: `<p>${t("greeting")}</p><p>${t("subscriptionExpiringBody", { ...values, accountName: escapeHtml(nomCommercial) })}</p><p><a href="${SITE_URL}${url}">${t("subscriptionExpiringLink")}</a></p>`,
      },
    });
    if (due === 15) stats.first++;
    else stats.last++;
  }

  return stats;
}
