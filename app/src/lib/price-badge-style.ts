import type { PriceBadge } from "@/lib/price-badge";

export const PRICE_BADGE_STYLE: Record<PriceBadge, string> = {
  TRES_BONNE_AFFAIRE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  BON_PRIX: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CORRECT: "bg-amber-50 text-amber-700 border-amber-200",
  ELEVE: "bg-orange-50 text-orange-700 border-orange-200",
  TRES_ELEVE: "bg-red-50 text-red-700 border-red-200",
};

export const PRICE_BADGE_KEY: Record<PriceBadge, string> = {
  TRES_BONNE_AFFAIRE: "tresBonneAffaire",
  BON_PRIX: "bonPrix",
  CORRECT: "correct",
  ELEVE: "eleve",
  TRES_ELEVE: "tresEleve",
};
