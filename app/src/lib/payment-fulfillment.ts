import { getTranslations } from "next-intl/server";
import type { ListingFormula, ListingStatus, ProSubscriptionTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formulaValidityDays, isListingUpgradable, UPGRADABLE_STATUSES } from "@/lib/payment-orders";
import { SUBSCRIPTION_VALIDITY_DAYS } from "@/lib/pro-subscription";
import { computeExpiryDate } from "@/lib/listing-lifecycle";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";

// Lot 264 — ce qu'une commande CONFIRMÉE déclenche (mise en formule d'une annonce, passage de palier
// d'un compte pro, courriel au vendeur), partagé par la revue admin, le webhook Chargily et la relecture
// manuelle du statut : une seule logique d'activation, quel que soit le canal qui a prouvé le paiement.
//
// Lot 265 (audit 2026-10-08, constat A1) — deux garanties ajoutées :
//   1. la bascule EN_ATTENTE → CONFIRMEE et l'activation sont dans la MÊME transaction : une panne entre
//      les deux ne peut plus laisser une commande payée jamais appliquée (que le rejeu aurait ignorée) ;
//   2. l'annonce n'est activée que si elle est encore PUBLIEE ou EXPIREE au moment de la preuve de
//      paiement. Suspendue, refusée ou vendue entre-temps : la commande RESTE EN_ATTENTE, annotée
//      « listing_not_upgradable », pour qu'un humain tranche depuis /admin/paiements — jamais une
//      republication automatique qui contournerait la modération.
// Idempotence : `updateMany` filtré sur le statut — un webhook rejoué, un webhook ET une relecture, ou deux
// admins : un seul gagne (`count` = 1), les autres ne font rien — jamais deux activations ni deux courriels.

// Le client Prisma du projet est étendu (journal des requêtes lentes) : son client de transaction n'est pas
// `Prisma.TransactionClient`. On type structurellement sur les modèles utilisés — accepte `prisma` et `tx`.
type Tx = Pick<typeof prisma, "paymentOrder" | "proSubscriptionOrder" | "listing" | "proSubscription">;
type Db = Pick<typeof prisma, "paymentOrder" | "proSubscriptionOrder">;

export type PaymentSource = "virement" | "chargily";
export type ConfirmActor = { kind: "provider" } | { kind: "admin"; adminId: string; note?: string | null };
export type ConfirmOutcome = "confirmed" | "already_decided" | "not_found" | "listing_not_upgradable";
// Alias conservé pour les appelants du Lot 264.
export type FulfillmentOutcome = ConfirmOutcome;

const NOT_UPGRADABLE_NOTE = "listing_not_upgradable";

class ListingNotUpgradableError extends Error {
  constructor(readonly listingStatus: ListingStatus) {
    super(NOT_UPGRADABLE_NOTE);
  }
}

// Activation conditionnelle : `updateMany` filtré sur les statuts éligibles. `false` = l'annonce n'est
// plus activable (course entre la lecture et l'écriture) ; l'appelant annule alors la transaction.
async function activateListingFormula(
  tx: Tx,
  listing: { id: string; status: ListingStatus; publishedAt: Date | null },
  formula: ListingFormula,
  now: Date
): Promise<boolean> {
  const { count } = await tx.listing.updateMany({
    where: { id: listing.id, status: { in: UPGRADABLE_STATUSES } },
    data: {
      formula,
      status: "PUBLIEE",
      expiresAt: computeExpiryDate(now, formulaValidityDays(formula)),
      publishedAt: listing.status === "EXPIREE" ? now : listing.publishedAt,
      // Nouveau cycle d'expiration (même principe que le renouvellement, Lot 48).
      expiryReminderSentAt: null,
    },
  });
  return count === 1;
}

async function activateProSubscription(tx: Tx, professionalAccountId: string, tier: ProSubscriptionTier, now: Date): Promise<void> {
  const newExpiresAt = computeExpiryDate(now, SUBSCRIPTION_VALIDITY_DAYS);
  await tx.proSubscription.upsert({
    where: { professionalAccountId },
    create: { professionalAccountId, tier, expiresAt: newExpiresAt },
    update: { tier, expiresAt: newExpiresAt },
  });
}

function confirmationData(actor: ConfirmActor, now: Date) {
  return {
    status: "CONFIRMEE" as const,
    // Date à laquelle le paiement a été constaté (prestataire ou humain) — jamais nulle sur une CONFIRMEE.
    paidAt: now,
    reviewedAt: now,
    reviewedById: actor.kind === "admin" ? actor.adminId : null,
    reviewNote: actor.kind === "admin" ? (actor.note ?? null) : null,
  };
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

// Confirme une commande de formule d'annonce et active la formule, atomiquement. Le courriel part
// APRÈS la validation de la transaction (jamais pour une activation annulée).
export async function confirmListingFormulaOrder(orderId: string, now: Date, actor: ConfirmActor): Promise<ConfirmOutcome> {
  type Done = { outcome: ConfirmOutcome; email?: { user: Recipient; listing: { id: string; title: string }; source: PaymentSource } };
  let done: Done;
  try {
    done = await prisma.$transaction(async (tx): Promise<Done> => {
      const order = await tx.paymentOrder.findUnique({ where: { id: orderId }, include: { listing: true, user: true } });
      if (!order) return { outcome: "not_found" };
      if (order.status !== "EN_ATTENTE") return { outcome: "already_decided" };
      if (!isListingUpgradable(order.listing.status)) {
        await tx.paymentOrder.updateMany({
          where: { id: orderId, status: "EN_ATTENTE" },
          data: { reviewNote: `${NOT_UPGRADABLE_NOTE}:${order.listing.status}` },
        });
        return { outcome: "listing_not_upgradable" };
      }
      const { count } = await tx.paymentOrder.updateMany({ where: { id: orderId, status: "EN_ATTENTE" }, data: confirmationData(actor, now) });
      if (count === 0) return { outcome: "already_decided" };
      if (!(await activateListingFormula(tx, order.listing, order.formula, now))) {
        throw new ListingNotUpgradableError(order.listing.status);
      }
      return {
        outcome: "confirmed",
        email: { user: order.user, listing: order.listing, source: order.provider === "CHARGILY" ? "chargily" : "virement" },
      };
    });
  } catch (err) {
    if (err instanceof ListingNotUpgradableError) {
      // La transaction a été annulée : la commande est toujours EN_ATTENTE ; on l'annote pour l'admin.
      await prisma.paymentOrder.updateMany({
        where: { id: orderId, status: "EN_ATTENTE" },
        data: { reviewNote: `${NOT_UPGRADABLE_NOTE}:${err.listingStatus}` },
      });
      return "listing_not_upgradable";
    }
    throw err;
  }
  if (done.email) {
    await sendListingFormulaDecisionEmail(done.email.user, done.email.listing, { approved: true, source: done.email.source });
  }
  return done.outcome;
}

export async function confirmProSubscriptionOrder(orderId: string, now: Date, actor: ConfirmActor): Promise<ConfirmOutcome> {
  type Done = { outcome: ConfirmOutcome; email?: { user: Recipient; account: { nomCommercial: string }; tier: ProSubscriptionTier; source: PaymentSource } };
  const done = await prisma.$transaction(async (tx): Promise<Done> => {
    const order = await tx.proSubscriptionOrder.findUnique({ where: { id: orderId }, include: { professionalAccount: true, user: true } });
    if (!order) return { outcome: "not_found" };
    if (order.status !== "EN_ATTENTE") return { outcome: "already_decided" };
    const { count } = await tx.proSubscriptionOrder.updateMany({ where: { id: orderId, status: "EN_ATTENTE" }, data: confirmationData(actor, now) });
    if (count === 0) return { outcome: "already_decided" };
    await activateProSubscription(tx, order.professionalAccountId, order.tier, now);
    return {
      outcome: "confirmed",
      email: { user: order.user, account: order.professionalAccount, tier: order.tier, source: order.provider === "CHARGILY" ? "chargily" : "virement" },
    };
  });
  if (done.email) {
    await sendProSubscriptionDecisionEmail(done.email.user, done.email.account, done.email.tier, { approved: true, source: done.email.source });
  }
  return done.outcome;
}

// Confirmation prouvée par le PRESTATAIRE (webhook signé ou relecture du statut) : pas de relecteur humain.
export function fulfillListingFormulaOrderFromProvider(orderId: string, now: Date): Promise<ConfirmOutcome> {
  return confirmListingFormulaOrder(orderId, now, { kind: "provider" });
}

export function fulfillProSubscriptionOrderFromProvider(orderId: string, now: Date): Promise<ConfirmOutcome> {
  return confirmProSubscriptionOrder(orderId, now, { kind: "provider" });
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

// Lot 265 — une annonce qui quitte le marché (suspension, refus, vente) ou un compte supprimé rend ses
// commandes EN_ATTENTE sans objet : elles passent ANNULEE pour que le paiement, s'il arrive encore, ne
// soit pas appliqué (la confirmation ne part que d'EN_ATTENTE) et que la place soit libérée.
export async function cancelPendingOrdersForListing(db: Db, listingId: string, note: string, now: Date): Promise<number> {
  const { count } = await db.paymentOrder.updateMany({
    where: { listingId, status: "EN_ATTENTE" },
    data: { status: "ANNULEE", reviewNote: note.slice(0, 500), reviewedAt: now },
  });
  return count;
}

export async function cancelPendingOrdersForUser(db: Db, userId: string, note: string, now: Date): Promise<number> {
  const data = { status: "ANNULEE" as const, reviewNote: note.slice(0, 500), reviewedAt: now };
  const [listings, subscriptions] = await Promise.all([
    db.paymentOrder.updateMany({ where: { userId, status: "EN_ATTENTE" }, data }),
    db.proSubscriptionOrder.updateMany({ where: { userId, status: "EN_ATTENTE" }, data }),
  ]);
  return listings.count + subscriptions.count;
}
