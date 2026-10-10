import type { FuelType } from "@prisma/client";

// Lot 283 — vignette automobile estimée, seule donnée de « coût d'usage » retenue car entièrement officielle et
// déterministe (contrairement à une consommation ou une assurance, jamais inventées sur ce projet — cf. RoadTest).
// Barème tourisme de la loi de finances 2026, par puissance fiscale et âge du véhicule ; électrique et hybride
// exonérés (le GPL ne l'est plus depuis cette loi). Pas de barème utilitaire : le catalogue n'a pas de PTAC.
// Source : https://www.demarchesdz.com/vignette-voiture/ (Loi de finances 2026, DGI).
type AgeBracket = { belowYears: number | null; amountDzd: number };

const AGE_BRACKETS_BY_POWER: { maxFiscalPower: number | null; brackets: AgeBracket[] }[] = [
  {
    maxFiscalPower: 6,
    brackets: [
      { belowYears: 3, amountDzd: 2000 },
      { belowYears: 6, amountDzd: 1500 },
      { belowYears: 10, amountDzd: 1000 },
      { belowYears: null, amountDzd: 500 },
    ],
  },
  {
    maxFiscalPower: 9,
    brackets: [
      { belowYears: 3, amountDzd: 4000 },
      { belowYears: 6, amountDzd: 3000 },
      { belowYears: 10, amountDzd: 2000 },
      { belowYears: null, amountDzd: 1500 },
    ],
  },
  {
    // 10 CV et plus.
    maxFiscalPower: null,
    brackets: [
      { belowYears: 3, amountDzd: 25000 },
      { belowYears: 6, amountDzd: 20000 },
      { belowYears: 10, amountDzd: 15000 },
      { belowYears: null, amountDzd: 10000 },
    ],
  },
];

const EXEMPT_FUEL_TYPES: readonly FuelType[] = ["ELECTRIQUE", "HYBRIDE"];

export function computeVignetteDzd(input: {
  fiscalPower: number;
  fuelType: FuelType | null;
  vehicleAgeYears: number;
}): number {
  if (input.fuelType && EXEMPT_FUEL_TYPES.includes(input.fuelType)) return 0;

  const powerGroup =
    AGE_BRACKETS_BY_POWER.find((g) => g.maxFiscalPower !== null && input.fiscalPower <= g.maxFiscalPower) ??
    AGE_BRACKETS_BY_POWER[AGE_BRACKETS_BY_POWER.length - 1];
  const bracket =
    powerGroup.brackets.find((b) => b.belowYears !== null && input.vehicleAgeYears < b.belowYears) ??
    powerGroup.brackets[powerGroup.brackets.length - 1];
  return bracket.amountDzd;
}

// Isolée du composant qui l'appelle : la règle de pureté de React interdit new Date() dans le corps du composant.
export function vehicleAgeYears(registrationYear: number, now: Date = new Date()): number {
  return Math.max(0, now.getFullYear() - registrationYear);
}
