import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { activateProSubscription, sendProSubscriptionDecisionEmail } from "@/lib/payment-fulfillment";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});

// Réservé à ADMIN, même sensibilité que la revue des virements de formule
// d'annonce (Lot 66/69) — argent réel, jamais ouvert à MODERATEUR.
// Lot 264 : activation et courriel partagés avec le webhook Chargily (payment-fulfillment).
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
  const isApproval = parsed.data.action === "approve";

  // Même garde atomique que payment-orders/[id]/review (Lot 69) : deux admins
  // ne peuvent pas trancher deux fois la même demande.
  const { count } = await prisma.proSubscriptionOrder.updateMany({
    where: { id, status: "EN_ATTENTE" },
    data: {
      status: isApproval ? "CONFIRMEE" : "REJETEE",
      reviewedById: user.id,
      reviewedAt: now,
      reviewNote: parsed.data.reason?.trim() || null,
    },
  });
  if (count === 0) {
    return NextResponse.json({ error: "invalid_transition" }, { status: 400 });
  }

  if (isApproval) {
    await activateProSubscription(order.professionalAccountId, order.tier, now);
  }

  await writeAuditLog({
    adminId: user.id,
    action: `pro_subscription_order.${parsed.data.action}`,
    targetType: "ProSubscriptionOrder",
    targetId: id,
    details: {
      professionalAccountId: order.professionalAccountId,
      tier: order.tier,
      amountDzd: order.amountDzd,
      provider: order.provider,
      reference: order.reference,
      reason: parsed.data.reason ?? null,
    },
  });

  await sendProSubscriptionDecisionEmail(
    order.user,
    order.professionalAccount,
    order.tier,
    isApproval
      ? { approved: true, source: order.provider === "CHARGILY" ? "chargily" : "virement" }
      : { approved: false, reason: parsed.data.reason?.trim() ?? "" }
  );

  return NextResponse.json({ status: isApproval ? "CONFIRMEE" : "REJETEE" });
}
