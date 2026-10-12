import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { canManageListing } from "@/lib/listing-access";
import { checkFormulaUpgradeEligible, priceForFormula } from "@/lib/payment-orders";
import { getPaymentSettings, isBankDetailsComplete } from "@/lib/payment-settings";
import { CHARGILY_WEBHOOK_PATH, ChargilyApiError, createChargilyCheckout, resolveChargilyConfig } from "@/lib/chargily";
import { SITE_URL } from "@/lib/site";

// Lot 264 — deux moyens de paiement : « virement » (référence fournie par le vendeur, rapprochement
// humain, Lot 66) ou « chargily » (paiement en ligne CIB / Edahabia, confirmation par webhook).
const bodySchema = z
  .object({
    formula: z.enum(["PREMIUM", "PREMIUM_PLUS"]),
    method: z.enum(["virement", "chargily"]).default("virement"),
    reference: z.string().trim().min(2).max(80).optional(),
  })
  .refine((b) => b.method !== "virement" || Boolean(b.reference), { message: "reference_required", path: ["reference"] });

// Un collaborateur gererAnnonces peut passer une annonce du compte pro en
// formule payante — même règle que gérer/renouveler/tarifer une annonce
// (Lot 43/61).
export const POST = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`upgrade-formula:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!(await canManageListing(user.id, listing.sellerId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const settings = await getPaymentSettings();
  const chargily = resolveChargilyConfig(process.env);
  if (body.method === "virement" && !isBankDetailsComplete(settings)) {
    return NextResponse.json({ error: "bank_details_missing" }, { status: 400 });
  }
  if (body.method === "chargily" && chargily.mode !== "enabled") {
    return NextResponse.json({ error: "online_payment_unavailable" }, { status: 400 });
  }

  const pendingOrder = await prisma.paymentOrder.findFirst({
    where: { listingId: id, status: "EN_ATTENTE" },
  });

  const eligibility = checkFormulaUpgradeEligible({
    status: listing.status,
    currentFormula: listing.formula,
    targetFormula: body.formula,
    hasPendingOrder: Boolean(pendingOrder),
  });
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 400 });
  }

  const amountDzd = priceForFormula(body.formula, settings);
  const isChargily = body.method === "chargily";

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
        formula: body.formula,
        amountDzd,
        provider: isChargily ? "CHARGILY" : "VIREMENT",
        // Pour Chargily, la référence est posée après création (identifiant de la commande) : le
        // vendeur n'a rien à saisir.
        reference: isChargily ? "CHARGILY" : body.reference!,
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

  // La commande existe AVANT le checkout (son identifiant sert de référence) ; si Chargily ne répond
  // pas, elle est supprimée : jamais une commande EN_ATTENTE sans checkout qui bloquerait l'annonce.
  const locale = user.locale === "ar" ? "ar" : "fr";
  const returnBase = `${SITE_URL}/${locale}/compte/mes-annonces`;
  try {
    const checkout = await createChargilyCheckout(chargily.config, {
      amountDzd,
      successUrl: `${returnBase}?paiement=ok`,
      failureUrl: `${returnBase}?paiement=echec`,
      webhookEndpoint: `${SITE_URL}${CHARGILY_WEBHOOK_PATH}`,
      description: `Souq Autos — formule ${body.formula} — annonce ${id} — commande ${order.id}`,
      locale,
    });
    order = await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { reference: order.id, providerCheckoutId: checkout.id },
    });
    return NextResponse.json({ order, checkoutUrl: checkout.checkoutUrl }, { status: 201 });
  } catch (err) {
    await prisma.paymentOrder.delete({ where: { id: order.id } }).catch(() => undefined);
    const message = err instanceof ChargilyApiError ? err.message : (err as Error).message;
    console.error(`[chargily] création de checkout impossible (annonce ${id}) : ${message}`);
    return NextResponse.json({ error: "provider_unavailable" }, { status: 502 });
  }
});
