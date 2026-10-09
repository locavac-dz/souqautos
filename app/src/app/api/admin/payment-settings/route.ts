import { NextRequest, NextResponse } from "next/server";
import { requireRole, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth-server/roles";
import { getPaymentSettings, validatePriceDzd } from "@/lib/payment-settings";
import { validateDualApprovalThreshold } from "@/lib/dual-approval";
import { writeAuditLog } from "@/lib/audit-log";

const bodySchema = z.object({
  bankName: z.string().trim().max(120),
  bankRib: z.string().trim().max(60),
  bankAccountHolder: z.string().trim().max(120),
  premiumPriceDzd: z.number(),
  premiumPlusPriceDzd: z.number(),
  // Lot 278 — facultatif : un client qui ne l'envoie pas ne touche pas au seuil ; null = désactivé.
  dualApprovalThresholdDzd: z.number().nullable().optional(),
});

// Réservé à ADMIN, jamais MODERATEUR — mêmes coordonnées bancaires réelles de
// l'EURL, même niveau de sensibilité que les seuils de modération (Lot 47).
export async function PATCH(request: NextRequest) {
  const user = await requireRole(isAdmin);
  if (user instanceof NextResponse) return user;

  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const premiumCheck = validatePriceDzd(body.premiumPriceDzd);
  const premiumPlusCheck = validatePriceDzd(body.premiumPlusPriceDzd);
  if (!premiumCheck.ok || !premiumPlusCheck.ok) {
    return NextResponse.json({ error: "invalid_price" }, { status: 400 });
  }
  if (body.dualApprovalThresholdDzd !== undefined) {
    const thresholdCheck = validateDualApprovalThreshold(body.dualApprovalThresholdDzd);
    if (!thresholdCheck.ok) {
      return NextResponse.json({ error: thresholdCheck.error }, { status: 400 });
    }
  }

  const before = await getPaymentSettings();

  const data = {
    bankName: body.bankName || null,
    bankRib: body.bankRib || null,
    bankAccountHolder: body.bankAccountHolder || null,
    premiumPriceDzd: body.premiumPriceDzd,
    premiumPlusPriceDzd: body.premiumPlusPriceDzd,
    dualApprovalThresholdDzd: body.dualApprovalThresholdDzd === undefined ? before.dualApprovalThresholdDzd : body.dualApprovalThresholdDzd,
  };

  const settings = await prisma.paymentSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });

  await writeAuditLog({
    adminId: user.id,
    action: "payment_settings.update",
    targetType: "PaymentSettings",
    targetId: "singleton",
    details: {
      // Jamais le RIB en clair dans le journal d'audit — seule sa présence/absence compte.
      before: { ...before, bankRib: before.bankRib ? "•••" : null },
      after: {
        bankName: settings.bankName,
        bankRib: settings.bankRib ? "•••" : null,
        bankAccountHolder: settings.bankAccountHolder,
        premiumPriceDzd: settings.premiumPriceDzd,
        premiumPlusPriceDzd: settings.premiumPlusPriceDzd,
        dualApprovalThresholdDzd: settings.dualApprovalThresholdDzd,
      },
    },
  });

  return NextResponse.json({ settings });
}
