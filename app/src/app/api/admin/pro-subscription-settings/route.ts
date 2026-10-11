import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireRole, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth-server/roles";
import { getProSubscriptionSettings, validateQuota } from "@/lib/pro-subscription-settings";
import { validatePriceDzd } from "@/lib/payment-settings";
import { writeAuditLog } from "@/lib/audit-log";

const bodySchema = z.object({
  starterQuota: z.number(),
  businessQuota: z.number(),
  proQuota: z.number(),
  businessPriceDzd: z.number(),
  proPriceDzd: z.number(),
  premiumPriceDzd: z.number(),
});

// Réservé à ADMIN, même sensibilité que PaymentSettings (Lot 66) — ces
// chiffres déterminent directement ce qu'un vendeur pro paie et combien
// d'annonces son abonnement autorise.
export const PATCH = apiHandler(async (request: NextRequest) => {
  const user = await requireRole(isAdmin);
  if (user instanceof NextResponse) return user;

  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const { starterQuota, businessQuota, proQuota, businessPriceDzd, proPriceDzd, premiumPriceDzd } = body;
  const quotaChecks = [starterQuota, businessQuota, proQuota].map(validateQuota);
  const priceChecks = [businessPriceDzd, proPriceDzd, premiumPriceDzd].map(validatePriceDzd);
  if (quotaChecks.some((c) => !c.ok)) {
    return NextResponse.json({ error: "invalid_quota" }, { status: 400 });
  }
  if (priceChecks.some((c) => !c.ok)) {
    return NextResponse.json({ error: "invalid_price" }, { status: 400 });
  }

  // Un palier supérieur avec un quota inférieur ou égal au palier précédent
  // n'aurait aucun sens commercial (payer plus cher pour moins, ou pour
  // pareil) — jamais laissé passer silencieusement.
  if (!(starterQuota < businessQuota && businessQuota < proQuota)) {
    return NextResponse.json({ error: "quotas_not_increasing" }, { status: 400 });
  }
  if (!(businessPriceDzd < proPriceDzd && proPriceDzd < premiumPriceDzd)) {
    return NextResponse.json({ error: "prices_not_increasing" }, { status: 400 });
  }

  const before = await getProSubscriptionSettings();

  const data = { starterQuota, businessQuota, proQuota, businessPriceDzd, proPriceDzd, premiumPriceDzd };
  const settings = await prisma.proSubscriptionSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });

  await writeAuditLog({
    adminId: user.id,
    action: "pro_subscription_settings.update",
    targetType: "ProSubscriptionSettings",
    targetId: "singleton",
    details: { before, after: data },
  });

  return NextResponse.json({ settings });
});
