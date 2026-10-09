import type { PriceBadge } from "@/lib/price-badge";

// Lot 269 (audit D4) — variantes sombres : les pastilles claires (texte -700 sur fond -50) tombaient sous 2:1 de
// contraste sur les cartes en mode sombre.
export const PRICE_BADGE_STYLE: Record<PriceBadge, string> = {
  TRES_BONNE_AFFAIRE: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  BON_PRIX: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  CORRECT: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  ELEVE: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  TRES_ELEVE: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
};

export const PRICE_BADGE_KEY: Record<PriceBadge, string> = {
  TRES_BONNE_AFFAIRE: "tresBonneAffaire",
  BON_PRIX: "bonPrix",
  CORRECT: "correct",
  ELEVE: "eleve",
  TRES_ELEVE: "tresEleve",
};
