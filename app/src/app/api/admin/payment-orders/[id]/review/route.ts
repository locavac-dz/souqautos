import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { confirmListingFormulaOrder, sendListingFormulaDecisionEmail } from "@/lib/payment-fulfillment";
import { checkProviderBeforeDecision } from "@/lib/admin-payment-decision";
import { recordPaymentEvent } from "@/lib/payment-events";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});

// Réservé à ADMIN : un virement bancaire n'est jamais vérifié automatiquement
// (aucune API bancaire branchée) — seul un humain rapproche la référence
// fournie par le vendeur avec le relevé réel, même logique de confirmation
// humaine que la vérification d'identité (Lot 14). Plus sensible qu'une
// action de modération courante (argent réel), donc pas ouvert à MODERATEUR.
// Lot 264 : une commande Chargily EN_ATTENTE (webhook jamais arrivé) peut aussi être tranchée ici,
// après vérification dans le tableau de bord Chargily — l'activation est la même (payment-fulfillment).
// Lot 265 : l'approbation passe par `confirmListingFormulaOrder` (transaction + contrôle du statut de
// l'annonce) — une annonce suspendue entre-temps n'est pas republiée : 400 `listing_not_upgradable`.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  if (parsed.data.action === "reject" && !parsed.data.reason?.trim()) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }

  const order = await prisma.paymentOrder.findUnique({
    where: { id },
    include: { listing: true, user: true },
  });
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (order.status !== "EN_ATTENTE") {
    return NextResponse.json({ error: "invalid_transition" }, { status: 400 });
  }

  const now = new Date();
  const isApproval = parsed.data.action === "approve";
  const reason = parsed.data.reason?.trim() || null;

  // Lot 266 — pour une commande Chargily, le prestataire est relu AVANT la décision : on ne refuse pas un
  // paiement qu'il déclare payé, on n'approuve pas un paiement qu'il ne déclare pas payé.
  const providerCheck = await checkProviderBeforeDecision(order, parsed.data.action);
  if (!providerCheck.ok) {
    return NextResponse.json({ error: providerCheck.error, providerStatus: providerCheck.providerStatus }, { status: providerCheck.httpStatus });
  }

  if (isApproval) {
    const outcome = await confirmListingFormulaOrder(id, now, { kind: "admin", adminId: user.id, note: reason });
    if (outcome === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (outcome === "already_decided") return NextResponse.json({ error: "invalid_transition" }, { status: 400 });
    if (outcome === "listing_not_upgradable") {
      return NextResponse.json({ error: "listing_not_upgradable", listingStatus: order.listing.status }, { status: 400 });
    }
  } else {
    // Deux admins pourraient trancher la même demande en même temps (deux onglets, double-clic) :
    // `updateMany` filtré sur EN_ATTENTE est atomique — si `count` vaut 0, une autre requête a gagné.
    const { count } = await prisma.paymentOrder.updateMany({
      where: { id, status: "EN_ATTENTE" },
      data: { status: "REJETEE", reviewedById: user.id, reviewedAt: now, reviewNote: reason },
    });
    if (count === 0) {
      return NextResponse.json({ error: "invalid_transition" }, { status: 400 });
    }
    await sendListingFormulaDecisionEmail(order.user, order.listing, { approved: false, reason: reason ?? "" });
  }

  await recordPaymentEvent({
    orderKind: "listing_formula",
    orderId: id,
    source: "ADMIN",
    outcome: isApproval ? "confirmed" : "rejected",
    providerStatus: providerCheck.providerStatus,
    actorUserId: user.id,
  });

  await writeAuditLog({
    adminId: user.id,
    action: `payment_order.${parsed.data.action}`,
    targetType: "PaymentOrder",
    targetId: id,
    details: {
      listingId: order.listingId,
      formula: order.formula,
      amountDzd: order.amountDzd,
      provider: order.provider,
      reference: order.reference,
      reason: parsed.data.reason ?? null,
    },
  });

  return NextResponse.json({ status: isApproval ? "CONFIRMEE" : "REJETEE" });
}
