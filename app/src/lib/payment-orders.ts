import type { ListingFormula, ListingStatus, PaymentOrderStatus } from "@prisma/client";

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

// Lot 68 — tableau de bord de statistiques de paiement (revenus, taux de
// confirmation), proposé à la clôture du Lot 66 une fois le paiement en
// place. Le taux de confirmation ne compte que les demandes déjà tranchées
// (CONFIRMEE/REJETEE) : une demande EN_ATTENTE n'a encore rien prouvé, ni
// dans un sens ni dans l'autre, et compter les demandes EN_ATTENTE au
// dénominateur biaiserait le taux à la baisse sans raison. `null` (plutôt
// qu'un 0% fabriqué) tant qu'aucune demande n'a encore été tranchée.
export type PaymentOrderStatsInput = {
  status: PaymentOrderStatus;
  formula: ListingFormula;
  amountDzd: number;
};

// Lot 264 — ANNULEE (paiement en ligne échoué/annulé par l'acheteur) n'est ni une confirmation ni un
// refus humain : comptée à part, hors du taux de confirmation.
export type PaymentOrderStats = {
  confirmedCount: number;
  rejectedCount: number;
  pendingCount: number;
  canceledCount: number;
  confirmationRate: number | null;
  totalRevenueDzd: number;
  premiumRevenueDzd: number;
  premiumPlusRevenueDzd: number;
};

export function computePaymentOrderStats(orders: PaymentOrderStatsInput[]): PaymentOrderStats {
  let confirmedCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;
  let canceledCount = 0;
  let totalRevenueDzd = 0;
  let premiumRevenueDzd = 0;
  let premiumPlusRevenueDzd = 0;

  for (const order of orders) {
    if (order.status === "EN_ATTENTE") {
      pendingCount += 1;
      continue;
    }
    if (order.status === "REJETEE") {
      rejectedCount += 1;
      continue;
    }
    if (order.status === "ANNULEE") {
      canceledCount += 1;
      continue;
    }
    confirmedCount += 1;
    totalRevenueDzd += order.amountDzd;
    if (order.formula === "PREMIUM_PLUS") {
      premiumPlusRevenueDzd += order.amountDzd;
    } else {
      premiumRevenueDzd += order.amountDzd;
    }
  }

  const decidedCount = confirmedCount + rejectedCount;
  const confirmationRate = decidedCount > 0 ? confirmedCount / decidedCount : null;

  return {
    confirmedCount,
    rejectedCount,
    pendingCount,
    canceledCount,
    confirmationRate,
    totalRevenueDzd,
    premiumRevenueDzd,
    premiumPlusRevenueDzd,
  };
}
