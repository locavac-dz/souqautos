// Lot 253 — simulateur Murābaha (financement islamique)
// Formule : la banque achète le bien au prix demandé, le revend au client
// avec une marge bénéficiaire fixe convenue à l'avance. Pas d'intérêt
// composé — la marge est calculée une fois sur la durée totale du contrat.

export const ISLAMIC_BANKS = [
  { id: "albaraka", nameFr: "Al Baraka Banque",             nameAr: "بنك البركة الجزائر",               annualRate: 0.06  },
  { id: "bna",      nameFr: "BNA — guichet islamique",      nameAr: "البنك الوطني — النافذة الإسلامية", annualRate: 0.065 },
  { id: "cpa",      nameFr: "CPA — guichet islamique",      nameAr: "القرض الشعبي — النافذة الإسلامية", annualRate: 0.065 },
  { id: "badr",     nameFr: "BADR — guichet islamique",     nameAr: "بدر — النافذة الإسلامية",          annualRate: 0.07  },
] as const;

export type IslamicBank = (typeof ISLAMIC_BANKS)[number];

export const ISLAMIC_DURATION_OPTIONS = [12, 24, 36, 48, 60] as const;
export const ISLAMIC_DEFAULT_MONTHS = 36;
export const ISLAMIC_DEFAULT_BANK_ID = "albaraka";

export type IslamicFinancingResult = {
  salePrice: number;    // prix de vente banque → client (prix d'achat + marge totale)
  totalMargin: number;  // marge bénéficiaire totale = salePrice - price
  financed: number;     // montant effectivement financé = salePrice - apport
  monthly: number;      // mensualité arrondie au dinar
};

export function computeIslamicFinancing({
  price,
  downPayment,
  annualRate,
  durationMonths,
}: {
  price: number;
  downPayment: number;
  annualRate: number;
  durationMonths: number;
}): IslamicFinancingResult | null {
  if (price <= 0 || durationMonths <= 0) return null;
  const years = durationMonths / 12;
  const totalMargin = Math.round(price * annualRate * years);
  const salePrice = price + totalMargin;
  const financed = salePrice - downPayment;
  if (financed <= 0) return null;
  const monthly = Math.round(financed / durationMonths);
  return { salePrice, totalMargin, financed, monthly };
}
