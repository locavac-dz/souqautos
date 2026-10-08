import type { ListingCategory } from "@prisma/client";

// Carburant / boîte / kilométrage n'ont de sens que pour un véhicule motorisé,
// jamais pour un équipement (remorque, coffre de toit, attelage…).
export function hasVehicleFields(category: ListingCategory | undefined): boolean {
  return category !== "EQUIPEMENT";
}

// Portes/places/transmission 4x2-4x4 n'ont de sens que pour un véhicule à
// quatre roues (voiture, utilitaire, poids lourd) — jamais pour un deux-roues
// ni pour un équipement.
export function hasCarBodyFields(category: ListingCategory | undefined): boolean {
  return category !== "DEUX_ROUES" && category !== "EQUIPEMENT";
}
