// Lot 149 — calcul de mensualité d'un crédit auto (formule annuité constante)

export type CreditInput = {
  price: number;
  downPayment: number;
  annualRatePct: number;
  durationMonths: number;
};

export type CreditResult = {
  principal: number;
  monthly: number;
  total: number;
  interest: number;
};

export function computeCredit(input: CreditInput): CreditResult | null {
  const { price, downPayment, annualRatePct, durationMonths } = input;
  if (price <= 0 || durationMonths <= 0 || annualRatePct < 0) return null;

  const principal = Math.max(0, price - downPayment);
  if (principal === 0) return null;

  const n = durationMonths;
  const r = annualRatePct / 100 / 12;

  let monthly: number;
  if (r === 0) {
    monthly = principal / n;
  } else {
    const factor = Math.pow(1 + r, n);
    monthly = (principal * r * factor) / (factor - 1);
  }

  const total = monthly * n + downPayment;
  const interest = total - price;

  return { principal, monthly: Math.round(monthly), total: Math.round(total), interest: Math.round(interest) };
}

export const CREDIT_DURATION_OPTIONS = [12, 24, 36, 48, 60, 72, 84] as const;
export const CREDIT_DEFAULT_RATE = 9.5;
export const CREDIT_DEFAULT_MONTHS = 60;
