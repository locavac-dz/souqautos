import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { formulaValidityDays } from "@/lib/payment-orders";
import { computeExpiryDate } from "@/lib/listing-lifecycle";
import { writeAuditLog } from "@/lib/audit-log";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});

// Réservé à ADMIN : un virement bancaire n'est jamais vérifié automatiquement
// (aucune API bancaire branchée) — seul un humain rapproche la référence
// fournie par le vendeur avec le relevé réel, même logique de confirmation
// humaine que la vérification d'identité (Lot 14). Plus sensible qu'une
// action de modération courante (argent réel), donc pas ouvert à MODERATEUR.
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

  await prisma.paymentOrder.update({
    where: { id },
    data: {
      status: isApproval ? "CONFIRMEE" : "REJETEE",
      reviewedById: user.id,
      reviewedAt: now,
      reviewNote: parsed.data.reason?.trim() || null,
    },
  });

  if (isApproval) {
    const newExpiresAt = computeExpiryDate(now, formulaValidityDays(order.formula));
    await prisma.listing.update({
      where: { id: order.listingId },
      data: {
        formula: order.formula,
        status: "PUBLIEE",
        expiresAt: newExpiresAt,
        publishedAt: order.listing.status === "EXPIREE" ? now : order.listing.publishedAt,
        // Nouveau cycle d'expiration (même principe que le renouvellement, Lot 48).
        expiryReminderSentAt: null,
      },
    });
  }

  await writeAuditLog({
    adminId: user.id,
    action: `payment_order.${parsed.data.action}`,
    targetType: "PaymentOrder",
    targetId: id,
    details: {
      listingId: order.listingId,
      formula: order.formula,
      amountDzd: order.amountDzd,
      reference: order.reference,
      reason: parsed.data.reason ?? null,
    },
  });

  // Même famille de notification que les Lots 62-64 : l'auteur de la demande
  // ne doit pas avoir à revisiter lui-même « Mes annonces » pour savoir si
  // son virement a été validé.
  const t = await getTranslations({ locale: order.user.locale, namespace: "Notifications" });
  const listingLink = `${SITE_URL}/${order.user.locale}/annonce/${order.listingId}`;
  const manageLink = `${SITE_URL}/${order.user.locale}/compte/mes-annonces`;
  const title = escapeHtml(order.listing.title);

  const subject = isApproval ? t("paymentApprovedSubject") : t("paymentRejectedSubject");
  const html = isApproval
    ? `<p>${t("greeting")}</p><p>${t("paymentApprovedBody", { title })}</p><p><a href="${listingLink}">${t("paymentApprovedLink")}</a></p>`
    : `<p>${t("greeting")}</p><p>${t("paymentRejectedBody", {
        title,
        reason: escapeHtml(parsed.data.reason?.trim() ?? ""),
      })}</p><p><a href="${manageLink}">${t("paymentRejectedLink")}</a></p>`;

  const emailResult = await sendEmail({ to: order.user.email, subject, html }).catch((err) => {
    console.error(`[EMAIL commande de paiement] échec envoi: ${(err as Error).message}`);
    return null;
  });
  if (emailResult?.previewUrl) {
    console.log(`[EMAIL commande de paiement] ${emailResult.previewUrl}`);
  }

  return NextResponse.json({ status: isApproval ? "CONFIRMEE" : "REJETEE" });
}
