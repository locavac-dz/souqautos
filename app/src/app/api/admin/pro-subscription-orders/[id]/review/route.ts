import { NextRequest, NextResponse } from "next/server";
import { requireRole, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { confirmProSubscriptionOrder, sendProSubscriptionDecisionEmail } from "@/lib/payment-fulfillment";
import { checkProviderBeforeDecision } from "@/lib/admin-payment-decision";
import { recordPaymentEvent } from "@/lib/payment-events";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});

// Réservé à ADMIN, même sensibilité que la revue des virements de formule
// d'annonce (Lot 66/69) — argent réel, jamais ouvert à MODERATEUR.
// Lot 264/265 : approbation via `confirmProSubscriptionOrder` (transaction, activation, courriel),
// partagée avec le webhook Chargily.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(isAdmin);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  if (body.action === "reject" && !body.reason?.trim()) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }

  const order = await prisma.proSubscriptionOrder.findUnique({
    where: { id },
    include: { professionalAccount: true, user: true },
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

  // Lot 266 — relecture chez Chargily avant la décision (voir payment-orders/[id]/review).
  const providerCheck = await checkProviderBeforeDecision(order, body.action);
  if (!providerCheck.ok) {
    return NextResponse.json({ error: providerCheck.error, providerStatus: providerCheck.providerStatus }, { status: providerCheck.httpStatus });
  }

  if (isApproval) {
    const outcome = await confirmProSubscriptionOrder(id, now, { kind: "admin", adminId: user.id, note: reason });
    if (outcome === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (outcome !== "confirmed") return NextResponse.json({ error: "invalid_transition" }, { status: 400 });
  } else {
    // Même garde atomique que payment-orders/[id]/review (Lot 69).
    const { count } = await prisma.proSubscriptionOrder.updateMany({
      where: { id, status: "EN_ATTENTE" },
      data: { status: "REJETEE", reviewedById: user.id, reviewedAt: now, reviewNote: reason },
    });
    if (count === 0) {
      return NextResponse.json({ error: "invalid_transition" }, { status: 400 });
    }
    await sendProSubscriptionDecisionEmail(order.user, order.professionalAccount, order.tier, { approved: false, reason: reason ?? "" });
  }

  await recordPaymentEvent({
    orderKind: "pro_subscription",
    orderId: id,
    source: "ADMIN",
    outcome: isApproval ? "confirmed" : "rejected",
    providerStatus: providerCheck.providerStatus,
    actorUserId: user.id,
  });

  await writeAuditLog({
    adminId: user.id,
    action: `pro_subscription_order.${body.action}`,
    targetType: "ProSubscriptionOrder",
    targetId: id,
    details: {
      professionalAccountId: order.professionalAccountId,
      tier: order.tier,
      amountDzd: order.amountDzd,
      provider: order.provider,
      reference: order.reference,
      reason: body.reason ?? null,
    },
  });

  return NextResponse.json({ status: isApproval ? "CONFIRMEE" : "REJETEE" });
}
