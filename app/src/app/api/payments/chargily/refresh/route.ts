import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { ChargilyApiError, resolveChargilyConfig, retrieveChargilyCheckout } from "@/lib/chargily";
import { applyChargilyCheckoutState, checkoutStatusFromRetrieve } from "@/lib/chargily-events";

const bodySchema = z.object({
  kind: z.enum(["listing_formula", "pro_subscription"]),
  orderId: z.string().min(1).max(64),
});

// Lot 264 — relecture du statut d'un checkout CHEZ Chargily, à la demande du vendeur (« Vérifier le
// paiement »). Secours quand le webhook n'est pas arrivé (perdu, ou serveur de développement injoignable
// depuis Internet). Ce n'est pas l'acheteur qui affirme avoir payé : on interroge le prestataire avec
// notre clé secrète, puis on applique EXACTEMENT la même transition que le webhook.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!(await checkRateLimit(`chargily-refresh:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const resolution = resolveChargilyConfig(process.env);
  if (resolution.mode !== "enabled") {
    return NextResponse.json({ error: "chargily_not_configured" }, { status: 503 });
  }

  const { kind, orderId } = parsed.data;
  // Seul l'auteur de la commande peut en demander la relecture — une commande d'autrui répond 404,
  // sans révéler qu'elle existe.
  const order =
    kind === "listing_formula"
      ? await prisma.paymentOrder.findFirst({ where: { id: orderId, userId: user.id }, select: { provider: true, providerCheckoutId: true, status: true } })
      : await prisma.proSubscriptionOrder.findFirst({ where: { id: orderId, userId: user.id }, select: { provider: true, providerCheckoutId: true, status: true } });
  if (!order || order.provider !== "CHARGILY" || !order.providerCheckoutId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (order.status !== "EN_ATTENTE") {
    return NextResponse.json({ status: order.status, outcome: "already_decided" });
  }

  let checkout;
  try {
    checkout = await retrieveChargilyCheckout(resolution.config, order.providerCheckoutId);
  } catch (err) {
    const message = err instanceof ChargilyApiError ? err.message : (err as Error).message;
    console.error(`[chargily] relecture impossible pour la commande ${orderId} : ${message}`);
    return NextResponse.json({ error: "provider_unavailable" }, { status: 502 });
  }

  const now = new Date();
  const state = checkoutStatusFromRetrieve(checkout);
  const outcome = await applyChargilyCheckoutState(checkout, state, now, `chargily:${checkout.status ?? "unknown"}`);
  // Statut relu en base plutôt que déduit de l'issue : « already_decided » peut aussi vouloir dire ANNULEE ou REJETEE.
  const refreshed =
    kind === "listing_formula"
      ? await prisma.paymentOrder.findUnique({ where: { id: orderId }, select: { status: true } })
      : await prisma.proSubscriptionOrder.findUnique({ where: { id: orderId }, select: { status: true } });
  return NextResponse.json({ status: refreshed?.status ?? "EN_ATTENTE", outcome, providerStatus: checkout.status ?? null });
}
