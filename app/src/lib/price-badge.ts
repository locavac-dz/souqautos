export type PriceBadge =
  | "TRES_BONNE_AFFAIRE"
  | "BON_PRIX"
  | "CORRECT"
  | "ELEVE"
  | "TRES_ELEVE";

const MIN_SAMPLE_SIZE_FOR_BADGE = 3;

// Seuils indicatifs (écart au prix médian du marché), cf. docs/ARCHITECTURE.md §11.
export function computePriceBadge(
  price: number,
  estimateMid: number,
  sampleSize: number
): { badge: PriceBadge; deviationPct: number } | null {
  if (sampleSize < MIN_SAMPLE_SIZE_FOR_BADGE || estimateMid <= 0) return null;

  const deviationPct = Math.round(((price - estimateMid) / estimateMid) * 100);

  let badge: PriceBadge;
  if (deviationPct <= -15) badge = "TRES_BONNE_AFFAIRE";
  else if (deviationPct <= -5) badge = "BON_PRIX";
  else if (deviationPct <= 5) badge = "CORRECT";
  else if (deviationPct <= 20) badge = "ELEVE";
  else badge = "TRES_ELEVE";

  return { badge, deviationPct };
}
