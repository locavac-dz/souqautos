import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { SUBSCRIPTION_VALIDITY_DAYS } from "@/lib/pro-subscription";
import { computeExpiryDate } from "@/lib/listing-lifecycle";
import { writeAuditLog } from "@/lib/audit-log";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});

// Réservé à ADMIN, même sensibilité que la revue des virements de formule
// d'annonce (Lot 66/69) — argent réel, jamais ouvert à MODERATEUR.
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
    const newExpiresAt = computeExpiryDate(now, SUBSCRIPTION_VALIDITY_DAYS);
    await prisma.proSubscription.upsert({
      where: { professionalAccountId: order.professionalAccountId },
      create: { professionalAccountId: order.professionalAccountId, tier: order.tier, expiresAt: newExpiresAt },
      update: { tier: order.tier, expiresAt: newExpiresAt },
    });
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
      reference: order.reference,
      reason: parsed.data.reason ?? null,
    },
  });

  const t = await getTranslations({ locale: order.user.locale, namespace: "Notifications" });
  const dashboardLink = `${SITE_URL}/${order.user.locale}/pro/tableau-de-bord`;
  const accountName = escapeHtml(order.professionalAccount.nomCommercial);

  const subject = isApproval ? t("subscriptionApprovedSubject") : t("subscriptionRejectedSubject");
  const html = isApproval
    ? `<p>${t("greeting")}</p><p>${t("subscriptionApprovedBody", { accountName, tier: order.tier })}</p><p><a href="${dashboardLink}">${t("subscriptionApprovedLink")}</a></p>`
    : `<p>${t("greeting")}</p><p>${t("subscriptionRejectedBody", {
        accountName,
        reason: escapeHtml(parsed.data.reason?.trim() ?? ""),
      })}</p><p><a href="${dashboardLink}">${t("subscriptionRejectedLink")}</a></p>`;

  const emailResult = await sendEmail({ to: order.user.email, subject, html }).catch((err) => {
    console.error(`[EMAIL abonnement pro] échec envoi: ${(err as Error).message}`);
    return null;
  });
  if (emailResult?.previewUrl) {
    console.log(`[EMAIL abonnement pro] ${emailResult.previewUrl}`);
  }

  return NextResponse.json({ status: isApproval ? "CONFIRMEE" : "REJETEE" });
}
