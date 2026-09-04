import { z } from "zod";

// Un même sous-ensemble de clés que /recherche (cf. searchParamsSchema) —
// stocké tel quel (chaînes brutes) puis revalidé via searchParamsSchema au
// moment de la comparaison avec une nouvelle annonce, jamais interprété
// autrement. "sort"/"page" sont volontairement exclus : ils ne changent rien
// à la correspondance d'une annonce avec la recherche sauvegardée.
const ALERT_FILTER_KEYS = [
  "q",
  "category",
  "brandId",
  "modelId",
  "wilayaId",
  "priceMin",
  "priceMax",
  "yearMin",
  "yearMax",
  "mileageMax",
  "fuelType",
  "gearbox",
  "condition",
] as const;

export const MAX_ALERTS_PER_USER = 10;

export const createSearchAlertSchema = z.object({
  label: z.string().trim().min(2).max(80),
  filters: z.record(z.string(), z.string()),
});

export type CreateSearchAlertInput = z.infer<typeof createSearchAlertSchema>;

// Ne garde que les clés reconnues — une alerte ne doit jamais mémoriser un
// paramètre hors périmètre (ex: "page") ni un champ arbitraire fourni par le
// client.
export function sanitizeAlertFilters(filters: Record<string, string>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const key of ALERT_FILTER_KEYS) {
    const value = filters[key];
    if (value !== undefined && value !== "") clean[key] = value;
  }
  return clean;
}

// Refuse une alerte "vide" (aucun critère) : elle correspondrait à absolument
// toute nouvelle annonce publiée sur le site, jamais l'intention réelle d'un
// utilisateur qui enregistre une recherche.
export function hasAtLeastOneFilter(filters: Record<string, string>): boolean {
  return Object.keys(filters).length > 0;
}
