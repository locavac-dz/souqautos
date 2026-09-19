// Menus déroulants des filtres de recherche (prix, année, kilométrage) : des
// paliers usuels plutôt qu'un champ libre. Les valeurs restent celles que
// `searchParamsSchema` sait lire (nombres entiers dans l'adresse), donc les
// adresses existantes, les recherches sauvegardées et le conseiller IA
// continuent de fonctionner sans changement.

// Paliers de prix en dinars, adaptés aux prix du marché algérien.
export const PRICE_STEPS_DZD = [
  500_000, 1_000_000, 1_500_000, 2_000_000, 2_500_000, 3_000_000, 3_500_000, 4_000_000, 5_000_000,
  6_000_000, 7_000_000, 8_000_000, 10_000_000, 12_000_000, 15_000_000, 20_000_000, 30_000_000,
];

export const MILEAGE_STEPS_KM = [
  10_000, 25_000, 50_000, 75_000, 100_000, 125_000, 150_000, 200_000, 250_000, 300_000,
];

export const OLDEST_YEAR_OPTION = 1990;

// De l'année courante (incluse) à 1990, la plus récente d'abord.
export function yearOptions(currentYear: number): number[] {
  return Array.from({ length: currentYear - OLDEST_YEAR_OPTION + 1 }, (_, i) => currentYear - i);
}

// « 0 », une valeur vide ou illisible n'est pas un filtre : le serveur l'ignore
// déjà (`buildListingWhere` teste la véracité de la valeur), l'écran doit donc
// afficher « aucun filtre » plutôt qu'un « 0 » trompeur.
export function normalizeFilterValue(value: string | undefined): string {
  return value && /^\d+$/.test(value) && Number(value) > 0 ? String(Number(value)) : "";
}

// Une valeur qui vient de l'adresse (lien partagé, alerte sauvegardée,
// conseiller IA) peut ne pas figurer dans les paliers : elle est ajoutée à la
// liste pour que le menu l'affiche fidèlement au lieu de l'effacer ou de la
// remplacer par un palier voisin.
export function optionsWithCurrent(
  steps: number[],
  current: string | undefined,
  order: "asc" | "desc" = "asc"
): number[] {
  const value = Number(normalizeFilterValue(current));
  if (!value || steps.includes(value)) return steps;
  return [...steps, value].sort((a, b) => (order === "asc" ? a - b : b - a));
}
