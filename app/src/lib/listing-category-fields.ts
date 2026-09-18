import type { ListingCategory } from "@prisma/client";

// Portes/places/transmission 4x2-4x4 n'ont de sens que pour un véhicule à
// quatre roues (voiture, utilitaire, poids lourd) — jamais pour un deux-roues.
export function hasCarBodyFields(category: ListingCategory | undefined): boolean {
  return category !== "DEUX_ROUES";
}
