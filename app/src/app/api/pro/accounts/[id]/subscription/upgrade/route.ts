import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkSubscriptionUpgradeEligible, priceForTier } from "@/lib/pro-subscription";
import { getProSubscriptionSettings } from "@/lib/pro-subscription-settings";
import { getPaymentSettings, isBankDetailsComplete } from "@/lib/payment-settings";
import { CHARGILY_WEBHOOK_PATH, ChargilyApiError, createChargilyCheckout, resolveChargilyConfig } from "@/lib/chargily";
import { SITE_URL } from "@/lib/site";

// Lot 264 — même double choix que upgrade-formula : virement (référence) ou Chargily (en ligne).
const bodySchema = z
  .object({
    tier: z.enum(["BUSINESS", "PRO", "PREMIUM"]),
    method: z.enum(["virement", "chargily"]).default("virement"),
    reference: z.string().trim().min(2).max(80).optional(),
  })
  .refine((b) => b.method !== "virement" || Boolean(b.reference), { message: "reference_required", path: ["reference"] });

// Réservé au propriétaire du compte pro — jamais un collaborateur, même avec
// gererAnnonces : décision financière engageant l'entreprise, même sensibilité
// que la gestion des collaborateurs (src/lib/pro-account.ts, canManageCollaborators).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`subscription-upgrade:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const account = await prisma.professionalAccount.findUnique({
    where: { id },
    include: { subscription: true },
  });
  if (!account) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (account.userId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const paymentSettings = await getPaymentSettings();
  const chargily = resolveChargilyConfig(process.env);
  if (parsed.data.method === "virement" && !isBankDetailsComplete(paymentSettings)) {
    return NextResponse.json({ error: "bank_details_missing" }, { status: 400 });
  }
  if (parsed.data.method === "chargily" && chargily.mode !== "enabled") {
    return NextResponse.json({ error: "online_payment_unavailable" }, { status: 400 });
  }

  const pendingOrder = await prisma.proSubscriptionOrder.findFirst({
    where: { professionalAccountId: id, status: "EN_ATTENTE" },
  });

  const currentTier = account.subscription?.tier ?? "STARTER";
  const eligibility = checkSubscriptionUpgradeEligible({
    currentTier,
    targetTier: parsed.data.tier,
    hasPendingOrder: Boolean(pendingOrder),
  });
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 400 });
  }

  const subscriptionSettings = await getProSubscriptionSettings();
  const amountDzd = priceForTier(parsed.data.tier, subscriptionSettings);
  const isChargily = parsed.data.method === "chargily";

  // Même garde-fou TOCTOU que PaymentOrder (Lot 69) : le `findFirst` ci-dessus
  // ne suffit pas seul contre un double-clic/retry réseau — l'index unique
  // filtré `ProSubscriptionOrder_pending_unique` est la garantie réelle.
  let order;
  try {
    order = await prisma.proSubscriptionOrder.create({
      data: {
        userId: user.id,
        professionalAccountId: id,
        tier: parsed.data.tier,
        amountDzd,
        provider: isChargily ? "CHARGILY" : "VIREMENT",
        reference: isChargily ? "CHARGILY" : parsed.data.reference!,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "order_pending" }, { status: 400 });
    }
    throw err;
  }

  if (!isChargily || chargily.mode !== "enabled") {
    return NextResponse.json({ order }, { status: 201 });
  }

  const locale = user.locale === "ar" ? "ar" : "fr";
  const returnBase = `${SITE_URL}/${locale}/pro/tableau-de-bord`;
  try {
    const checkout = await createChargilyCheckout(chargily.config, {
      amountDzd,
      successUrl: `${returnBase}?paiement=ok`,
      failureUrl: `${returnBase}?paiement=echec`,
      webhookEndpoint: `${SITE_URL}${CHARGILY_WEBHOOK_PATH}`,
      description: `Souq Auto — abonnement pro ${parsed.data.tier} — compte ${id} — commande ${order.id}`,
      locale,
    });
    order = await prisma.proSubscriptionOrder.update({
      where: { id: order.id },
      data: { reference: order.id, providerCheckoutId: checkout.id },
    });
    return NextResponse.json({ order, checkoutUrl: checkout.checkoutUrl }, { status: 201 });
  } catch (err) {
    await prisma.proSubscriptionOrder.delete({ where: { id: order.id } }).catch(() => undefined);
    const message = err instanceof ChargilyApiError ? err.message : (err as Error).message;
    console.error(`[chargily] création de checkout impossible (compte pro ${id}) : ${message}`);
    return NextResponse.json({ error: "provider_unavailable" }, { status: 502 });
  }
}
