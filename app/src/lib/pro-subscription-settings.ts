import { prisma } from "@/lib/prisma";

// Lot 83 — quotas/prix d'abonnement pro configurables en back-office, comme
// PaymentSettings (Lot 66) et ModerationSettings (Lot 47). Codés en dur
// jusqu'ici (Lot 79) — même trajectoire que AUTO_SUSPEND_*_THRESHOLD
// (Lot 21→47) : une valeur fonctionnelle d'abord, éditable ensuite.
export const DEFAULT_STARTER_QUOTA = 5;
export const DEFAULT_BUSINESS_QUOTA = 20;
export const DEFAULT_PRO_QUOTA = 60;
export const DEFAULT_BUSINESS_PRICE_DZD = 3000;
export const DEFAULT_PRO_PRICE_DZD = 6000;
export const DEFAULT_PREMIUM_PRICE_DZD = 12000;

export type ProSubscriptionSettingsValues = {
  starterQuota: number;
  businessQuota: number;
  proQuota: number;
  businessPriceDzd: number;
  proPriceDzd: number;
  premiumPriceDzd: number;
};

export async function getProSubscriptionSettings(): Promise<ProSubscriptionSettingsValues> {
  const settings = await prisma.proSubscriptionSettings.findUnique({ where: { id: "singleton" } });
  return {
    starterQuota: settings?.starterQuota ?? DEFAULT_STARTER_QUOTA,
    businessQuota: settings?.businessQuota ?? DEFAULT_BUSINESS_QUOTA,
    proQuota: settings?.proQuota ?? DEFAULT_PRO_QUOTA,
    businessPriceDzd: settings?.businessPriceDzd ?? DEFAULT_BUSINESS_PRICE_DZD,
    proPriceDzd: settings?.proPriceDzd ?? DEFAULT_PRO_PRICE_DZD,
    premiumPriceDzd: settings?.premiumPriceDzd ?? DEFAULT_PREMIUM_PRICE_DZD,
  };
}

export type QuotaValidation = { ok: true } | { ok: false; error: "invalid_quota" };

const MIN_QUOTA = 1;
const MAX_QUOTA = 100_000;

export function validateQuota(value: number): QuotaValidation {
  if (!Number.isInteger(value) || value < MIN_QUOTA || value > MAX_QUOTA) {
    return { ok: false, error: "invalid_quota" };
  }
  return { ok: true };
}
