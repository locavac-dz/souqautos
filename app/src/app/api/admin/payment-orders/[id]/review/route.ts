import { NextRequest, NextResponse } from "next/server";
import { requireRole, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { confirmListingFormulaOrder, sendListingFormulaDecisionEmail } from "@/lib/payment-fulfillment";
import { checkProviderBeforeDecision } from "@/lib/admin-payment-decision";
import { recordPaymentEvent } from "@/lib/payment-events";
import { getPaymentSettings } from "@/lib/payment-settings";
import { decideApprovalStep, requiresDualApproval } from "@/lib/dual-approval";

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
  const user = await requireRole(isAdmin);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  if (body.action === "reject" && !body.reason?.trim()) {
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
  const isApproval = body.action === "approve";
  const reason = body.reason?.trim() || null;

  // Lot 266 — pour une commande Chargily, le prestataire est relu AVANT la décision : on ne refuse pas un
  // paiement qu'il déclare payé, on n'approuve pas un paiement qu'il ne déclare pas payé.
  const providerCheck = await checkProviderBeforeDecision(order, body.action);
  if (!providerCheck.ok) {
    return NextResponse.json({ error: providerCheck.error, providerStatus: providerCheck.providerStatus }, { status: providerCheck.httpStatus });
  }

  // Lot 278 — au-dessus du seuil, un virement exige deux administrateurs différents : la première approbation
  // est enregistrée et la commande reste EN_ATTENTE ; seule la seconde, par une AUTRE personne, active.
  if (isApproval) {
    const settings = await getPaymentSettings();
    const step = decideApprovalStep({
      requiresDual: requiresDualApproval({ amountDzd: order.amountDzd, provider: order.provider, thresholdDzd: settings.dualApprovalThresholdDzd }),
      firstApprovedById: order.firstApprovedById,
      userId: user.id,
    });
    if (step === "same_approver") {
      return NextResponse.json({ error: "second_approver_required" }, { status: 409 });
    }
    if (step === "first_approval") {
      const { count } = await prisma.paymentOrder.updateMany({
        where: { id, status: "EN_ATTENTE", firstApprovedById: null },
        data: { firstApprovedById: user.id, firstApprovedAt: now },
      });
      if (count === 0) {
        return NextResponse.json({ error: "invalid_transition" }, { status: 400 });
      }
      await recordPaymentEvent({ orderKind: "listing_formula", orderId: id, source: "ADMIN", outcome: "first_approval", providerStatus: providerCheck.providerStatus, actorUserId: user.id });
      await writeAuditLog({ adminId: user.id, action: "payment_order.first_approve", targetType: "PaymentOrder", targetId: id, details: { amountDzd: order.amountDzd, provider: order.provider, reference: order.reference } });
      return NextResponse.json({ status: "EN_ATTENTE", awaitingSecondApproval: true });
    }
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
    action: `payment_order.${body.action}`,
    targetType: "PaymentOrder",
    targetId: id,
    details: {
      listingId: order.listingId,
      formula: order.formula,
      amountDzd: order.amountDzd,
      provider: order.provider,
      reference: order.reference,
      reason: body.reason ?? null,
    },
  });

  return NextResponse.json({ status: isApproval ? "CONFIRMEE" : "REJETEE" });
}
