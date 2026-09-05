import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { getPaymentSettings, validatePriceDzd } from "@/lib/payment-settings";
import { writeAuditLog } from "@/lib/audit-log";

const bodySchema = z.object({
  bankName: z.string().trim().max(120),
  bankRib: z.string().trim().max(60),
  bankAccountHolder: z.string().trim().max(120),
  premiumPriceDzd: z.number(),
  premiumPlusPriceDzd: z.number(),
});

// Réservé à ADMIN, jamais MODERATEUR — mêmes coordonnées bancaires réelles de
// l'EURL, même niveau de sensibilité que les seuils de modération (Lot 47).
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const premiumCheck = validatePriceDzd(parsed.data.premiumPriceDzd);
  const premiumPlusCheck = validatePriceDzd(parsed.data.premiumPlusPriceDzd);
  if (!premiumCheck.ok || !premiumPlusCheck.ok) {
    return NextResponse.json({ error: "invalid_price" }, { status: 400 });
  }

  const before = await getPaymentSettings();

  const data = {
    bankName: parsed.data.bankName || null,
    bankRib: parsed.data.bankRib || null,
    bankAccountHolder: parsed.data.bankAccountHolder || null,
    premiumPriceDzd: parsed.data.premiumPriceDzd,
    premiumPlusPriceDzd: parsed.data.premiumPlusPriceDzd,
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
      },
    },
  });

  return NextResponse.json({ settings });
}
