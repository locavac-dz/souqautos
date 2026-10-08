import { getTranslations } from "next-intl/server";
import type { ListingFormula, ListingStatus, ProSubscriptionTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formulaValidityDays } from "@/lib/payment-orders";
import { SUBSCRIPTION_VALIDITY_DAYS } from "@/lib/pro-subscription";
import { computeExpiryDate } from "@/lib/listing-lifecycle";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";

// Lot 264 — ce qu'une commande CONFIRMÉE déclenche (mise en formule d'une annonce, passage de palier
// d'un compte pro, courriel au vendeur), extrait des routes de revue admin (Lots 66/79) pour être
// partagé avec le webhook Chargily et la relecture manuelle du statut : une seule logique
// d'activation, quel que soit le canal qui a prouvé le paiement.
//
// Idempotence : la transition EN_ATTENTE → CONFIRMEE est un `updateMany` filtré sur le statut. Un webhook
// rejoué, un webhook ET une relecture manuelle, ou deux admins en même temps : un seul gagne (`count` = 1),
// les autres ne font rien — jamais deux activations ni deux courriels.

export type PaymentSource = "virement" | "chargily";
export type FulfillmentOutcome = "confirmed" | "already_decided" | "not_found";

export async function activateListingFormula(
  listing: { id: string; status: ListingStatus; publishedAt: Date | null },
  formula: ListingFormula,
  now: Date
): Promise<void> {
  const newExpiresAt = computeExpiryDate(now, formulaValidityDays(formula));
  await prisma.listing.update({
    where: { id: listing.id },
    data: {
      formula,
      status: "PUBLIEE",
      expiresAt: newExpiresAt,
      publishedAt: listing.status === "EXPIREE" ? now : listing.publishedAt,
      // Nouveau cycle d'expiration (même principe que le renouvellement, Lot 48).
      expiryReminderSentAt: null,
    },
  });
}

export async function activateProSubscription(professionalAccountId: string, tier: ProSubscriptionTier, now: Date): Promise<void> {
  const newExpiresAt = computeExpiryDate(now, SUBSCRIPTION_VALIDITY_DAYS);
  await prisma.proSubscription.upsert({
    where: { professionalAccountId },
    create: { professionalAccountId, tier, expiresAt: newExpiresAt },
    update: { tier, expiresAt: newExpiresAt },
  });
}

type Recipient = { email: string; locale: string };
type Decision = { approved: true; source: PaymentSource } | { approved: false; reason: string };

async function deliver(label: string, to: string, subject: string, html: string): Promise<void> {
  const result = await sendEmail({ to, subject, html }).catch((err) => {
    console.error(`[EMAIL ${label}] échec envoi: ${(err as Error).message}`);
    return null;
  });
  if (result?.previewUrl) console.log(`[EMAIL ${label}] ${result.previewUrl}`);
}

// Même famille de notification que les Lots 62-64 : le vendeur ne doit pas avoir à revisiter
// « Mes annonces » pour savoir si son paiement a été validé.
export async function sendListingFormulaDecisionEmail(user: Recipient, listing: { id: string; title: string }, decision: Decision): Promise<void> {
  const t = await getTranslations({ locale: user.locale, namespace: "Notifications" });
  const listingLink = `${SITE_URL}/${user.locale}/annonce/${listing.id}`;
  const manageLink = `${SITE_URL}/${user.locale}/compte/mes-annonces`;
  const title = escapeHtml(listing.title);
  if (decision.approved) {
    const bodyKey = decision.source === "chargily" ? "paymentOnlineApprovedBody" : "paymentApprovedBody";
    const html = `<p>${t("greeting")}</p><p>${t(bodyKey, { title })}</p><p><a href="${listingLink}">${t("paymentApprovedLink")}</a></p>`;
    await deliver("commande de paiement", user.email, t("paymentApprovedSubject"), html);
    return;
  }
  const html = `<p>${t("greeting")}</p><p>${t("paymentRejectedBody", { title, reason: escapeHtml(decision.reason) })}</p><p><a href="${manageLink}">${t("paymentRejectedLink")}</a></p>`;
  await deliver("commande de paiement", user.email, t("paymentRejectedSubject"), html);
}

export async function sendProSubscriptionDecisionEmail(user: Recipient, account: { nomCommercial: string }, tier: ProSubscriptionTier, decision: Decision): Promise<void> {
  const t = await getTranslations({ locale: user.locale, namespace: "Notifications" });
  const dashboardLink = `${SITE_URL}/${user.locale}/pro/tableau-de-bord`;
  const accountName = escapeHtml(account.nomCommercial);
  if (decision.approved) {
    const bodyKey = decision.source === "chargily" ? "subscriptionOnlineApprovedBody" : "subscriptionApprovedBody";
    const html = `<p>${t("greeting")}</p><p>${t(bodyKey, { accountName, tier })}</p><p><a href="${dashboardLink}">${t("subscriptionApprovedLink")}</a></p>`;
    await deliver("abonnement pro", user.email, t("subscriptionApprovedSubject"), html);
    return;
  }
  const html = `<p>${t("greeting")}</p><p>${t("subscriptionRejectedBody", { accountName, tier, reason: escapeHtml(decision.reason) })}</p><p><a href="${dashboardLink}">${t("subscriptionRejectedLink")}</a></p>`;
  await deliver("abonnement pro", user.email, t("subscriptionRejectedSubject"), html);
}

// Confirmation prouvée par le PRESTATAIRE (webhook signé ou relecture du statut) : pas de relecteur
// humain (`reviewedById` reste nul), `paidAt` renseigné.
export async function fulfillListingFormulaOrderFromProvider(orderId: string, now: Date): Promise<FulfillmentOutcome> {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId }, include: { listing: true, user: true } });
  if (!order) return "not_found";
  const { count } = await prisma.paymentOrder.updateMany({
    where: { id: orderId, status: "EN_ATTENTE" },
    data: { status: "CONFIRMEE", paidAt: now, reviewedAt: now },
  });
  if (count === 0) return "already_decided";
  await activateListingFormula(order.listing, order.formula, now);
  await sendListingFormulaDecisionEmail(order.user, order.listing, { approved: true, source: "chargily" });
  return "confirmed";
}

export async function fulfillProSubscriptionOrderFromProvider(orderId: string, now: Date): Promise<FulfillmentOutcome> {
  const order = await prisma.proSubscriptionOrder.findUnique({ where: { id: orderId }, include: { professionalAccount: true, user: true } });
  if (!order) return "not_found";
  const { count } = await prisma.proSubscriptionOrder.updateMany({
    where: { id: orderId, status: "EN_ATTENTE" },
    data: { status: "CONFIRMEE", paidAt: now, reviewedAt: now },
  });
  if (count === 0) return "already_decided";
  await activateProSubscription(order.professionalAccountId, order.tier, now);
  await sendProSubscriptionDecisionEmail(order.user, order.professionalAccount, order.tier, { approved: true, source: "chargily" });
  return "confirmed";
}

export type ProviderOrderKind = "listing_formula" | "pro_subscription";

// Échec / annulation côté prestataire : la commande passe ANNULEE (pas REJETEE, qui est une décision
// humaine) et libère la place pour une nouvelle tentative. Pas de courriel : l'acheteur vient de voir
// l'échec sur la page de paiement.
export async function cancelProviderOrder(kind: ProviderOrderKind, orderId: string, note: string, now: Date): Promise<boolean> {
  const data = { status: "ANNULEE" as const, reviewNote: note.slice(0, 500), reviewedAt: now };
  const { count } =
    kind === "listing_formula"
      ? await prisma.paymentOrder.updateMany({ where: { id: orderId, status: "EN_ATTENTE" }, data })
      : await prisma.proSubscriptionOrder.updateMany({ where: { id: orderId, status: "EN_ATTENTE" }, data });
  return count === 1;
}
