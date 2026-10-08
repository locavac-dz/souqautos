import { prisma } from "@/lib/prisma";
import type { ChargilyCheckout } from "@/lib/chargily";
import {
  cancelProviderOrder,
  fulfillListingFormulaOrderFromProvider,
  fulfillProSubscriptionOrderFromProvider,
  type ProviderOrderKind,
} from "@/lib/payment-fulfillment";

// Lot 264 — applique à une commande l'état d'un checkout Chargily, que cet état arrive par webhook
// (type d'événement) ou par relecture (`status` du checkout). Point unique, testé sans réseau.
//
// La commande est retrouvée par `providerCheckoutId` (unique sur chaque table), jamais par un
// identifiant que le prestataire aurait recopié depuis nos métadonnées : seule la clé que NOUS avons
// enregistrée à la création fait foi.

export type ChargilyOutcome =
  | "confirmed"
  | "already_decided"
  | "canceled"
  | "ignored" // statut sans effet (pending/processing) ou type d'événement inconnu
  | "unknown_checkout"
  | "not_found" // commande supprimée entre la recherche et l'activation (course avec un échec de création)
  | "listing_not_upgradable" // annonce suspendue / refusée / vendue depuis la commande : laissée à un humain (Lot 265)
  | "amount_mismatch";

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

export async function applyChargilyCheckoutState(
  checkout: ChargilyCheckout,
  state: "paid" | "canceled" | "ignored",
  now: Date,
  reason: string
): Promise<ChargilyOutcome> {
  if (state === "ignored") return "ignored";
  const order = await findOrderByCheckoutId(checkout.id);
  if (!order) return "unknown_checkout";

  if (state === "canceled") {
    const changed = await cancelProviderOrder(order.kind, order.id, reason, now);
    return changed ? "canceled" : "already_decided";
  }

  // Montant et devise tels que le prestataire les a encaissés : s'ils ne correspondent pas à la commande
  // (checkout modifié, devise inattendue), on n'active rien et on laisse la commande EN_ATTENTE pour
  // qu'un humain tranche depuis /admin/paiements.
  if (checkout.amount !== undefined && checkout.amount !== order.amountDzd) {
    console.error(`[chargily] montant inattendu pour la commande ${order.id} : ${checkout.amount} ≠ ${order.amountDzd}`);
    return "amount_mismatch";
  }
  if (checkout.currency !== undefined && checkout.currency.toLowerCase() !== "dzd") {
    console.error(`[chargily] devise inattendue pour la commande ${order.id} : ${checkout.currency}`);
    return "amount_mismatch";
  }

  return order.kind === "listing_formula"
    ? fulfillListingFormulaOrderFromProvider(order.id, now)
    : fulfillProSubscriptionOrderFromProvider(order.id, now);
}
