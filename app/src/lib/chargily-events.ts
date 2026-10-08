import type { PaymentEventSource, PaymentOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ChargilyApiError, resolveChargilyConfig, retrieveChargilyCheckout, type ChargilyCheckout } from "@/lib/chargily";
import {
  cancelProviderOrder,
  fulfillListingFormulaOrderFromProvider,
  fulfillProSubscriptionOrderFromProvider,
  type ProviderOrderKind,
} from "@/lib/payment-fulfillment";
import { recordPaymentEvent } from "@/lib/payment-events";
import { notifyStaffOfPending } from "@/lib/staff-alerts";

// Lot 264 — applique à une commande l'état d'un checkout Chargily, que cet état arrive par webhook
// (type d'événement) ou par relecture (`status` du checkout). Point unique, testé sans réseau.
//
// La commande est retrouvée par `providerCheckoutId` (unique sur chaque table), jamais par un
// identifiant que le prestataire aurait recopié depuis nos métadonnées : seule la clé que NOUS avons
// enregistrée à la création fait foi.
//
// Lot 266 (audit B1/B2) — chaque application est tracée (PaymentEvent) ; un montant inattendu annote la
// commande et alerte l'équipe ; `refreshChargilyOrder` relit un checkout à la demande (vendeur, admin) et
// `sweepPendingChargilyOrders` le fait chaque nuit pour les commandes restées en attente (webhook perdu).

export type ChargilyOutcome =
  | "confirmed"
  | "already_decided"
  | "canceled"
  | "ignored" // statut sans effet (pending/processing) ou type d'événement inconnu
  | "unknown_checkout"
  | "not_found" // commande supprimée entre la recherche et l'activation (course avec un échec de création)
  | "listing_not_upgradable" // annonce suspendue / refusée / vendue depuis la commande : laissée à un humain (Lot 265)
  | "amount_mismatch";

export type ChargilyApplyMeta = {
  source: PaymentEventSource;
  actorUserId?: string | null;
  providerEventId?: string | null;
};

type FoundOrder = { kind: ProviderOrderKind; id: string; amountDzd: number };

export async function findOrderByCheckoutId(checkoutId: string): Promise<FoundOrder | null> {
  const listingOrder = await prisma.paymentOrder.findUnique({
    where: { providerCheckoutId: checkoutId },
    select: { id: true, amountDzd: true },
  });
  if (listingOrder) return { kind: "listing_formula", ...listingOrder };
  const proOrder = await prisma.proSubscriptionOrder.findUnique({
    where: { providerCheckoutId: checkoutId },
    select: { id: true, amountDzd: true },
  });
  if (proOrder) return { kind: "pro_subscription", ...proOrder };
  return null;
}

// `paid` : seul statut qui active. `failed` / `canceled` / `expired` : commande ANNULEE. Le reste : rien.
export function checkoutStatusFromEvent(eventType: string, checkout: ChargilyCheckout): "paid" | "canceled" | "ignored" {
  const status = checkout.status;
  if (eventType === "checkout.paid") return status === undefined || status === "paid" ? "paid" : "ignored";
  if (eventType === "checkout.failed" || eventType === "checkout.canceled" || eventType === "checkout.expired") return "canceled";
  return "ignored";
}

export function checkoutStatusFromRetrieve(checkout: ChargilyCheckout): "paid" | "canceled" | "ignored" {
  if (checkout.status === "paid") return "paid";
  if (checkout.status === "failed" || checkout.status === "canceled" || checkout.status === "expired") return "canceled";
  return "ignored";
}

async function annotatePendingOrder(order: FoundOrder, note: string): Promise<void> {
  const args = { where: { id: order.id, status: "EN_ATTENTE" as const }, data: { reviewNote: note.slice(0, 500) } };
  if (order.kind === "listing_formula") await prisma.paymentOrder.updateMany(args);
  else await prisma.proSubscriptionOrder.updateMany(args);
}

async function applyToOrder(order: FoundOrder, checkout: ChargilyCheckout, state: "paid" | "canceled", now: Date, reason: string): Promise<ChargilyOutcome> {
  if (state === "canceled") {
    const changed = await cancelProviderOrder(order.kind, order.id, reason, now);
    return changed ? "canceled" : "already_decided";
  }

  // Montant et devise tels que le prestataire les a encaissés : s'ils ne correspondent pas à la commande
  // (checkout modifié, devise inattendue), on n'active rien et on laisse la commande EN_ATTENTE pour
  // qu'un humain tranche depuis /admin/paiements — annotée et signalée à l'équipe (Lot 266).
  const amountMismatch = checkout.amount !== undefined && checkout.amount !== order.amountDzd;
  const currencyMismatch = checkout.currency !== undefined && checkout.currency.toLowerCase() !== "dzd";
  if (amountMismatch || currencyMismatch) {
    console.error(`[chargily] montant/devise inattendus pour la commande ${order.id} : ${checkout.amount} ${checkout.currency} ≠ ${order.amountDzd} dzd`);
    await annotatePendingOrder(order, `chargily:amount_mismatch ${checkout.amount ?? "?"} ${checkout.currency ?? "?"}`);
    await notifyStaffOfPending("payment");
    return "amount_mismatch";
  }

  return order.kind === "listing_formula"
    ? fulfillListingFormulaOrderFromProvider(order.id, now)
    : fulfillProSubscriptionOrderFromProvider(order.id, now);
}

export async function applyChargilyCheckoutState(
  checkout: ChargilyCheckout,
  state: "paid" | "canceled" | "ignored",
  now: Date,
  reason: string,
  meta: ChargilyApplyMeta = { source: "WEBHOOK" }
): Promise<ChargilyOutcome> {
  if (state === "ignored") return "ignored";
  const order = await findOrderByCheckoutId(checkout.id);
  if (!order) return "unknown_checkout";

  const outcome = await applyToOrder(order, checkout, state, now, reason);
  await recordPaymentEvent({
    orderKind: order.kind,
    orderId: order.id,
    source: meta.source,
    outcome,
    providerEventId: meta.providerEventId ?? null,
    providerStatus: checkout.status ?? null,
    amount: checkout.amount ?? null,
    currency: checkout.currency ?? null,
    actorUserId: meta.actorUserId ?? null,
  });
  return outcome;
}

// Relecture d'un checkout CHEZ Chargily, à la demande (vendeur, admin) ou par le balayage. Ce n'est pas
// l'acheteur qui affirme avoir payé : on interroge le prestataire avec notre clé secrète, puis on applique
// EXACTEMENT la même transition que le webhook. `ownerUserId` restreint la commande à son auteur (vendeur).
export type RefreshResult =
  | { ok: true; outcome: ChargilyOutcome; status: PaymentOrderStatus; providerStatus: string | null }
  | { ok: false; error: "not_found" | "already_decided" | "chargily_not_configured" | "provider_unavailable"; status?: PaymentOrderStatus };

// Statuts depuis lesquels une relecture peut encore changer quelque chose : EN_ATTENTE, et ANNULEE (un
// checkout annulé côté prestataire puis finalement payé — parade de l'audit B2 — s'active quand même).
const REFRESHABLE: PaymentOrderStatus[] = ["EN_ATTENTE", "ANNULEE"];

export async function refreshChargilyOrder(opts: {
  kind: ProviderOrderKind;
  orderId: string;
  now: Date;
  meta: ChargilyApplyMeta;
  ownerUserId?: string;
}): Promise<RefreshResult> {
  const resolution = resolveChargilyConfig(process.env);
  if (resolution.mode !== "enabled") return { ok: false, error: "chargily_not_configured" };

  const where = { id: opts.orderId, ...(opts.ownerUserId ? { userId: opts.ownerUserId } : {}) };
  const select = { provider: true, providerCheckoutId: true, status: true } as const;
  const order =
    opts.kind === "listing_formula"
      ? await prisma.paymentOrder.findFirst({ where, select })
      : await prisma.proSubscriptionOrder.findFirst({ where, select });
  if (!order || order.provider !== "CHARGILY" || !order.providerCheckoutId) return { ok: false, error: "not_found" };
  if (!REFRESHABLE.includes(order.status)) return { ok: false, error: "already_decided", status: order.status };

  let checkout: ChargilyCheckout;
  try {
    checkout = await retrieveChargilyCheckout(resolution.config, order.providerCheckoutId);
  } catch (err) {
    const message = err instanceof ChargilyApiError ? err.message : (err as Error).message;
    console.error(`[chargily] relecture impossible pour la commande ${opts.orderId} : ${message}`);
    return { ok: false, error: "provider_unavailable", status: order.status };
  }

  const state = checkoutStatusFromRetrieve(checkout);
  const outcome = await applyChargilyCheckoutState(checkout, state, opts.now, `chargily:${checkout.status ?? "unknown"}`, opts.meta);
  // Statut relu en base plutôt que déduit de l'issue : « already_decided » peut aussi vouloir dire REJETEE.
  const refreshed =
    opts.kind === "listing_formula"
      ? await prisma.paymentOrder.findUnique({ where: { id: opts.orderId }, select: { status: true } })
      : await prisma.proSubscriptionOrder.findUnique({ where: { id: opts.orderId }, select: { status: true } });
  return { ok: true, outcome, status: refreshed?.status ?? order.status, providerStatus: checkout.status ?? null };
}

// Balayage (cron) des commandes Chargily EN_ATTENTE dont le webhook n'est jamais arrivé et que personne n'a
// relues : au bout d'une heure, on demande à Chargily. Payé → activation ; échoué / expiré → ANNULEE (la place
// est libérée) ; encore en cours → rien, on repassera. Si Chargily ne répond pas, on arrête la passe (inutile
// d'enchaîner 50 délais d'attente).
export type PendingSweepResult = { skipped: "chargily_not_configured" } | { checked: number; outcomes: Record<string, number>; stoppedEarly: boolean };

export async function sweepPendingChargilyOrders(
  now: Date,
  { minAgeMs = 60 * 60 * 1000, limit = 50 }: { minAgeMs?: number; limit?: number } = {}
): Promise<PendingSweepResult> {
  if (resolveChargilyConfig(process.env).mode !== "enabled") return { skipped: "chargily_not_configured" };
  const before = new Date(now.getTime() - minAgeMs);
  const where = { provider: "CHARGILY" as const, status: "EN_ATTENTE" as const, providerCheckoutId: { not: null }, createdAt: { lt: before } };
  const [listingOrders, proOrders] = await Promise.all([
    prisma.paymentOrder.findMany({ where, select: { id: true }, orderBy: { createdAt: "asc" }, take: limit }),
    prisma.proSubscriptionOrder.findMany({ where, select: { id: true }, orderBy: { createdAt: "asc" }, take: limit }),
  ]);
  const targets: { kind: ProviderOrderKind; id: string }[] = [
    ...listingOrders.map((o) => ({ kind: "listing_formula" as const, id: o.id })),
    ...proOrders.map((o) => ({ kind: "pro_subscription" as const, id: o.id })),
  ].slice(0, limit);

  const outcomes: Record<string, number> = {};
  let checked = 0;
  let stoppedEarly = false;
  for (const target of targets) {
    const result = await refreshChargilyOrder({ kind: target.kind, orderId: target.id, now, meta: { source: "SWEEP" } });
    checked += 1;
    const key = result.ok ? result.outcome : result.error;
    outcomes[key] = (outcomes[key] ?? 0) + 1;
    if (!result.ok && result.error === "provider_unavailable") {
      stoppedEarly = true;
      break;
    }
  }
  if (checked > 0) console.log(`[chargily] balayage des commandes en attente : ${checked} relue(s) → ${JSON.stringify(outcomes)}${stoppedEarly ? " (arrêt : Chargily injoignable)" : ""}`);
  return { checked, outcomes, stoppedEarly };
}
