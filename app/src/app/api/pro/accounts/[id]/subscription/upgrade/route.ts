import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkSubscriptionUpgradeEligible, priceForTier } from "@/lib/pro-subscription";
import { getPaymentSettings, isBankDetailsComplete } from "@/lib/payment-settings";

const bodySchema = z.object({
  tier: z.enum(["BUSINESS", "PRO", "PREMIUM"]),
  reference: z.string().trim().min(2).max(80),
});

// Réservé au propriétaire du compte pro — jamais un collaborateur, même avec
// gererAnnonces : décision financière engageant l'entreprise, même sensibilité
// que la gestion des collaborateurs (src/lib/pro-account.ts, canManageCollaborators).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!checkRateLimit(`subscription-upgrade:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 })) {
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

  const settings = await getPaymentSettings();
  if (!isBankDetailsComplete(settings)) {
    return NextResponse.json({ error: "bank_details_missing" }, { status: 400 });
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

  const amountDzd = priceForTier(parsed.data.tier);

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
        reference: parsed.data.reference,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "order_pending" }, { status: 400 });
    }
    throw err;
  }

  return NextResponse.json({ order }, { status: 201 });
}
