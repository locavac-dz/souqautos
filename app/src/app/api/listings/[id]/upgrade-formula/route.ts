import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { canManageListing } from "@/lib/listing-access";
import { checkFormulaUpgradeEligible, priceForFormula } from "@/lib/payment-orders";
import { getPaymentSettings, isBankDetailsComplete } from "@/lib/payment-settings";

const bodySchema = z.object({
  formula: z.enum(["PREMIUM", "PREMIUM_PLUS"]),
  reference: z.string().trim().min(2).max(80),
});

// Un collaborateur gererAnnonces peut passer une annonce du compte pro en
// formule payante — même règle que gérer/renouveler/tarifer une annonce
// (Lot 43/61).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!checkRateLimit(`upgrade-formula:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!(await canManageListing(user.id, listing.sellerId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const settings = await getPaymentSettings();
  if (!isBankDetailsComplete(settings)) {
    return NextResponse.json({ error: "bank_details_missing" }, { status: 400 });
  }

  const pendingOrder = await prisma.paymentOrder.findFirst({
    where: { listingId: id, status: "EN_ATTENTE" },
  });

  const eligibility = checkFormulaUpgradeEligible({
    status: listing.status,
    currentFormula: listing.formula,
    targetFormula: parsed.data.formula,
    hasPendingOrder: Boolean(pendingOrder),
  });
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 400 });
  }

  const amountDzd = priceForFormula(parsed.data.formula, settings);

  // Le `findFirst` ci-dessus ne suffit pas seul contre un double-clic/retry
  // réseau (TOCTOU) — l'index unique filtré `PaymentOrder_pending_unique`
  // (une seule ligne EN_ATTENTE par annonce) est la garantie réelle ; une
  // violation ici signifie qu'une autre requête a gagné la course entre-temps.
  let order;
  try {
    order = await prisma.paymentOrder.create({
      data: {
        userId: user.id,
        listingId: id,
        formula: parsed.data.formula,
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
