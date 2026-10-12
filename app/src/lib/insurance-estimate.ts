// Lot 297 — estimation de la prime RC automobile obligatoire (responsabilité civile).
// Barème indicatif 2026 pour véhicules de tourisme (usage privé), après les deux
// revalorisations de 2025 (+15 % au 1ᵉʳ janvier, +15 % au 1ᵉʳ juillet, soit ~32 %
// cumulés). Fourchette basse/haute par puissance fiscale ; la prime réelle varie
// selon l'assureur, la zone tarifaire (wilaya) et le coefficient bonus-malus.
// Source : CNA (cna.dz), barème réglementé RC automobile, loi de finances 2025.
//
// Lot 298 — comparateur de formules : RC seule, RC + tiers collision, tous risques.
// Les multiplicateurs tiers et tous risques sont des fourchettes indicatives basées
// sur les grilles tarifaires courantes du marché algérien (SAA, CAAT, Alliance, etc.).

type PowerBracket = {
  maxFiscalPower: number | null;
  lowDzd: number;
  highDzd: number;
};

const RC_BRACKETS: PowerBracket[] = [
  { maxFiscalPower: 5, lowDzd: 8_000, highDzd: 12_000 },
  { maxFiscalPower: 7, lowDzd: 11_000, highDzd: 15_000 },
  { maxFiscalPower: 10, lowDzd: 14_000, highDzd: 19_000 },
  { maxFiscalPower: 14, lowDzd: 18_000, highDzd: 23_000 },
  { maxFiscalPower: null, lowDzd: 22_000, highDzd: 28_000 },
];

export type RcEstimate = { lowDzd: number; highDzd: number };

export function estimateRcPremiumDzd(fiscalPower: number): RcEstimate {
  const bracket =
    RC_BRACKETS.find((b) => b.maxFiscalPower !== null && fiscalPower <= b.maxFiscalPower) ??
    RC_BRACKETS[RC_BRACKETS.length - 1];
  return { lowDzd: bracket.lowDzd, highDzd: bracket.highDzd };
}

export type InsuranceFormula = "rc" | "rc_tiers" | "tous_risques";

export type FormulaEstimate = {
  formula: InsuranceFormula;
  lowDzd: number;
  highDzd: number;
  covers: readonly string[];
};

const FORMULA_MULTIPLIERS: { formula: InsuranceFormula; lowMult: number; highMult: number; covers: readonly string[] }[] = [
  {
    formula: "rc",
    lowMult: 1,
    highMult: 1,
    covers: ["coverRcDamages", "coverRcInjury"],
  },
  {
    formula: "rc_tiers",
    lowMult: 1.5,
    highMult: 1.8,
    covers: ["coverRcDamages", "coverRcInjury", "coverCollision", "coverTheft", "coverFire"],
  },
  {
    formula: "tous_risques",
    lowMult: 2.8,
    highMult: 3.5,
    covers: ["coverRcDamages", "coverRcInjury", "coverCollision", "coverTheft", "coverFire", "coverGlass", "coverNatural", "coverOwnDamage"],
  },
];

export function estimateAllFormulas(fiscalPower: number): FormulaEstimate[] {
  const rc = estimateRcPremiumDzd(fiscalPower);
  return FORMULA_MULTIPLIERS.map(({ formula, lowMult, highMult, covers }) => ({
    formula,
    lowDzd: Math.round(rc.lowDzd * lowMult / 100) * 100,
    highDzd: Math.round(rc.highDzd * highMult / 100) * 100,
    covers,
  }));
}

export const FORMULA_KEYS: readonly InsuranceFormula[] = ["rc", "rc_tiers", "tous_risques"];
