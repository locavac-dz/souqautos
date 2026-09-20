import type { ListingCategory } from "@prisma/client";

// Lot 130 — le catalogue couvre quatre familles de véhicules. « AUTRE » (une annonce qui n'entre dans aucune
// famille : remorque, engin…) n'a volontairement PAS de catalogue : le vendeur saisit alors marque et modèle.
export const CATALOGUE_CATEGORIES = ["VOITURE", "UTILITAIRE", "POIDS_LOURD", "DEUX_ROUES"] as const satisfies readonly ListingCategory[];
export type CatalogueCategory = (typeof CATALOGUE_CATEGORIES)[number];

export const LISTING_CATEGORIES: readonly ListingCategory[] = [...CATALOGUE_CATEGORIES, "AUTRE"];

export function isCatalogueCategory(value: unknown): value is CatalogueCategory {
  return typeof value === "string" && (CATALOGUE_CATEGORIES as readonly string[]).includes(value);
}

// Un modèle est proposé dans une catégorie s'il la déclare. Sans catégorie choisie, ou pour « AUTRE »
// (pas de catalogue dédié), tout est proposé : on ne cache jamais une marque à quelqu'un qui n'a rien choisi.
export function modelInCategory(model: { categories: readonly ListingCategory[] }, category: ListingCategory | null | undefined): boolean {
  if (!category || !isCatalogueCategory(category)) return true;
  return model.categories.includes(category);
}

// Marques proposées pour une catégorie : celles qui ont au moins un modèle dans cette catégorie, réduites à ces
// modèles. La catégorie d'une marque se déduit ainsi de ses modèles (Renault : voitures, utilitaires, camions).
export function filterCatalogueByCategory<M extends { categories: readonly ListingCategory[] }, B extends { models: M[] }>(
  brands: readonly B[],
  category: ListingCategory | null | undefined
): B[] {
  if (!category || !isCatalogueCategory(category)) return [...brands];
  return brands
    .map((brand) => ({ ...brand, models: brand.models.filter((model) => modelInCategory(model, category)) }))
    .filter((brand) => brand.models.length > 0);
}

// Catégories d'un modèle saisies par l'administration : au moins une, sans doublon, uniquement des familles du
// catalogue (jamais « AUTRE »), dans l'ordre canonique.
export function normalizeModelCategories(input: unknown): CatalogueCategory[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  if (!input.every(isCatalogueCategory)) return null;
  const wanted = new Set<string>(input);
  return CATALOGUE_CATEGORIES.filter((category) => wanted.has(category));
}

// Famille(s) d'une marque, déduites de ses modèles, dans l'ordre canonique (pour les pastilles de l'index).
export function brandCategories(models: readonly { categories: readonly ListingCategory[] }[]): CatalogueCategory[] {
  return CATALOGUE_CATEGORIES.filter((category) => models.some((model) => model.categories.includes(category)));
}

// Adresses lisibles des filtres de l'index du catalogue : /voitures?categorie=poids-lourd.
const CATEGORY_SLUGS: Record<CatalogueCategory, string> = {
  VOITURE: "voiture",
  UTILITAIRE: "utilitaire",
  POIDS_LOURD: "poids-lourd",
  DEUX_ROUES: "deux-roues",
};

export function categorySlug(category: CatalogueCategory): string {
  return CATEGORY_SLUGS[category];
}

// Une valeur d'adresse inconnue, répétée (tableau) ou absente ne filtre rien : jamais d'erreur pour un lien mal formé.
export function categoryFromSlug(value: unknown): CatalogueCategory | undefined {
  if (typeof value !== "string") return undefined;
  return CATALOGUE_CATEGORIES.find((category) => CATEGORY_SLUGS[category] === value);
}
