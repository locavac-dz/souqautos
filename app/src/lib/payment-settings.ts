import { prisma } from "@/lib/prisma";

// Lot 66 — paramètres du premier mode de paiement réel (virement bancaire
// manuel), configurables en back-office comme ModerationSettings (Lot 47).
// Les coordonnées bancaires restent `null` tant qu'aucun admin ne les a
// renseignées — jamais une valeur inventée affichée à un vrai vendeur.
export const DEFAULT_PREMIUM_PRICE_DZD = 1000;
export const DEFAULT_PREMIUM_PLUS_PRICE_DZD = 2000;

export type PaymentSettingsValues = {
  bankName: string | null;
  bankRib: string | null;
  bankAccountHolder: string | null;
  premiumPriceDzd: number;
  premiumPlusPriceDzd: number;
};

export async function getPaymentSettings(): Promise<PaymentSettingsValues> {
  const settings = await prisma.paymentSettings.findUnique({ where: { id: "singleton" } });
  return {
    bankName: settings?.bankName ?? null,
    bankRib: settings?.bankRib ?? null,
    bankAccountHolder: settings?.bankAccountHolder ?? null,
    premiumPriceDzd: settings?.premiumPriceDzd ?? DEFAULT_PREMIUM_PRICE_DZD,
    premiumPlusPriceDzd: settings?.premiumPlusPriceDzd ?? DEFAULT_PREMIUM_PLUS_PRICE_DZD,
  };
}

// Coordonnées bancaires réellement affichables au vendeur — distinct de
// "settings existe" : les trois champs doivent être renseignés ensemble pour
// qu'un virement soit possible.
export function isBankDetailsComplete(settings: PaymentSettingsValues): boolean {
  return Boolean(settings.bankName && settings.bankRib && settings.bankAccountHolder);
}

export type PriceValidation = { ok: true } | { ok: false; error: "invalid_price" };

const MIN_PRICE_DZD = 1;
const MAX_PRICE_DZD = 1_000_000;

export function validatePriceDzd(value: number): PriceValidation {
  if (!Number.isInteger(value) || value < MIN_PRICE_DZD || value > MAX_PRICE_DZD) {
    return { ok: false, error: "invalid_price" };
  }
  return { ok: true };
}
