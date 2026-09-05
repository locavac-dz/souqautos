import type { ListingFormula, ListingStatus } from "@prisma/client";

// Lot 66 — durée de validité prolongée pour les formules payantes (§ cahier
// d'architecture : « Premium : ... durée prolongée »), même principe que
// LISTING_VALIDITY_DAYS (Lot 2) : une constante en dur, pas encore
// configurable, cohérent avec la façon dont ce projet introduit d'abord une
// valeur fonctionnelle avant de la rendre éditable si le besoin apparaît
// (cf. AUTO_SUSPEND_*_THRESHOLD, codé en dur au Lot 21, configurable au Lot 47).
export const PREMIUM_VALIDITY_DAYS = 45;
export const PREMIUM_PLUS_VALIDITY_DAYS = 60;

export function formulaValidityDays(formula: ListingFormula): number {
  switch (formula) {
    case "PREMIUM":
      return PREMIUM_VALIDITY_DAYS;
    case "PREMIUM_PLUS":
      return PREMIUM_PLUS_VALIDITY_DAYS;
    case "STANDARD":
    default:
      return 30; // LISTING_VALIDITY_DAYS — évite une dépendance circulaire avec listing-lifecycle.ts
  }
}

// Ordre de valeur des formules — jamais déduit du tri alphabétique de
// l'énumération (PREMIUM < PREMIUM_PLUS < STANDARD alphabétiquement, ce qui
// ne correspond à rien) : une échelle explicite, seule façon correcte de
// comparer "supérieur à".
const FORMULA_RANK: Record<ListingFormula, number> = {
  STANDARD: 0,
  PREMIUM: 1,
  PREMIUM_PLUS: 2,
};

export function formulaRank(formula: ListingFormula): number {
  return FORMULA_RANK[formula];
}

// Statuts depuis lesquels une annonce peut être mise en avant — mêmes
// statuts que le renouvellement (Lot 22) : jamais depuis SUSPENDUE/REFUSEE
// (contournerait la modération), ni depuis VENDUE ou BROUILLON.
const UPGRADABLE_STATUSES: ListingStatus[] = ["PUBLIEE", "EXPIREE"];

export type FormulaUpgradeEligibility =
  | { ok: true }
  | { ok: false; error: "invalid_status" | "not_an_upgrade" | "order_pending" };

export function checkFormulaUpgradeEligible({
  status,
  currentFormula,
  targetFormula,
  hasPendingOrder,
}: {
  status: ListingStatus;
  currentFormula: ListingFormula;
  targetFormula: ListingFormula;
  hasPendingOrder: boolean;
}): FormulaUpgradeEligibility {
  if (!UPGRADABLE_STATUSES.includes(status)) {
    return { ok: false, error: "invalid_status" };
  }
  if (hasPendingOrder) {
    return { ok: false, error: "order_pending" };
  }
  if (formulaRank(targetFormula) <= formulaRank(currentFormula)) {
    return { ok: false, error: "not_an_upgrade" };
  }
  return { ok: true };
}

export function priceForFormula(
  formula: "PREMIUM" | "PREMIUM_PLUS",
  settings: { premiumPriceDzd: number; premiumPlusPriceDzd: number }
): number {
  return formula === "PREMIUM" ? settings.premiumPriceDzd : settings.premiumPlusPriceDzd;
}
