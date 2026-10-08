import {
  listingSchema,
  listingCategories,
  fuelTypes,
  gearboxes,
  transmissions,
  conditions,
  type ListingInput,
} from "@/lib/validation/listing";
import { isCatalogueCategory } from "@/lib/vehicle-catalogue";
import type { ListingCategory } from "@prisma/client";

// Lot 130 — `modelCategories` (id de modèle → catégories) permet de refuser une ligne dont la marque ou le modèle
// n'existe pas dans la catégorie annoncée (un Actros en « DEUX_ROUES »). Absent : aucun contrôle de catégorie.
export type BrandLookup = { id: number; models: Map<string, number>; modelCategories?: Map<number, readonly ListingCategory[]> };
export type ImportLookups = {
  brands: Map<string, BrandLookup>;
  wilayas: Map<string, number>;
};

export type BulkImportRowResult =
  | { ok: true; data: ListingInput }
  | { ok: false; error: string };

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function parseEnum<T extends string>(value: string, allowed: readonly T[]): T | undefined {
  const upper = value.trim().toUpperCase();
  return (allowed as readonly string[]).includes(upper) ? (upper as T) : undefined;
}

function parseBoolean(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "oui" || v === "vrai" || v === "true" || v === "1";
}

function parseOptionalInt(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value.trim());
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

// Comblement de l'écart documenté depuis le Lot 13/29 (« import de stock en
// masse » pour comptes professionnels) : mappe une ligne CSV brute vers les
// mêmes champs que la création manuelle (Lot 2), puis délègue à listingSchema
// — aucune règle de validation dupliquée, un import suit exactement les mêmes
// contraintes qu'une annonce saisie à la main (longueurs, plages numériques,
// énumérations). Résolution marque/modèle/wilaya par nom (ou code pour la
// wilaya) contre le référentiel existant (Lot 1/25) ; une valeur non reconnue
// pour la marque devient du texte libre plutôt qu'un rejet (comme la saisie
// manuelle le permet déjà), mais une wilaya non reconnue rejette la ligne —
// il n'existe pas d'équivalent "texte libre" pour la wilaya dans le schéma.
export function mapCsvRowToListingInput(
  record: Record<string, string>,
  lookups: ImportLookups
): BulkImportRowResult {
  const category = parseEnum(record.categorie ?? "", listingCategories);
  if (!category) return { ok: false, error: "invalid_category" };

  const fuelType = parseEnum(record.carburant ?? "", fuelTypes);
  if (!fuelType) return { ok: false, error: "invalid_fuel_type" };

  const gearbox = parseEnum(record.boiteVitesses ?? "", gearboxes);
  if (!gearbox) return { ok: false, error: "invalid_gearbox" };

  const condition = parseEnum(record.etat ?? "", conditions);
  if (!condition) return { ok: false, error: "invalid_condition" };

  const transmissionRaw = (record.transmission ?? "").trim();
  const transmission = transmissionRaw === "" ? undefined : parseEnum(transmissionRaw, transmissions);
  if (transmissionRaw !== "" && !transmission) return { ok: false, error: "invalid_transmission" };

  const wilayaKey = normalizeKey(record.wilaya ?? "");
  const wilayaId = lookups.wilayas.get(wilayaKey);
  if (!wilayaId) return { ok: false, error: "unknown_wilaya" };

  const brandKey = normalizeKey(record.marque ?? "");
  const brand = lookups.brands.get(brandKey);
  let brandId: number | undefined;
  let brandFreeText: string | undefined;
  let modelId: number | undefined;
  let modelFreeText: string | undefined;

  if (brand) {
    brandId = brand.id;
    const modelKey = normalizeKey(record.modele ?? "");
    modelId = brand.models.get(modelKey);
    if (!modelId && record.modele?.trim()) modelFreeText = record.modele.trim();
    if (brand.modelCategories && isCatalogueCategory(category)) {
      const fits = modelId
        ? (brand.modelCategories.get(modelId) ?? []).includes(category)
        : [...brand.modelCategories.values()].some((categories) => categories.includes(category));
      if (!fits) return { ok: false, error: "wrong_category" };
    }
  } else if (record.marque?.trim()) {
    brandFreeText = record.marque.trim();
    if (record.modele?.trim()) modelFreeText = record.modele.trim();
  } else {
    return { ok: false, error: "missing_brand" };
  }

  const price = parseOptionalInt(record.prix ?? "");
  const year = parseOptionalInt(record.annee ?? "");
  const mileage = parseOptionalInt(record.kilometrage ?? "");
  const doors = parseOptionalInt(record.portes ?? "");
  const seats = parseOptionalInt(record.places ?? "");
  const powerHp = parseOptionalInt(record.puissance ?? "");

  if (price === undefined || Number.isNaN(price)) return { ok: false, error: "invalid_price" };
  if (year === undefined || Number.isNaN(year)) return { ok: false, error: "invalid_year" };
  if (mileage === undefined || Number.isNaN(mileage)) return { ok: false, error: "invalid_mileage" };

  const candidate = {
    category,
    brandId,
    brandFreeText,
    modelId,
    modelFreeText,
    title: record.titre ?? "",
    description: record.description ?? "",
    price,
    year,
    mileage,
    fuelType,
    gearbox,
    transmission,
    color: record.couleur?.trim() || undefined,
    doors: Number.isNaN(doors) ? undefined : doors,
    seats: Number.isNaN(seats) ? undefined : seats,
    powerHp: Number.isNaN(powerHp) ? undefined : powerHp,
    condition,
    firstHand: parseBoolean(record.premiereMain ?? ""),
    accidented: parseBoolean(record.accidente ?? ""),
    wilayaId,
  };

  const parsed = listingSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, error: "validation" };

  return { ok: true, data: parsed.data };
}

// Lot 81 — export de stock (§4-B, outil réservé aux paliers Pro/Premium) :
// même en-tête, même ordre de colonnes que l'import (Lot 41), pour qu'un
// fichier exporté puis modifié soit ré-importable tel quel sans adaptation.
export const EXPORT_CSV_HEADER = [
  "categorie",
  "marque",
  "modele",
  "titre",
  "description",
  "prix",
  "annee",
  "kilometrage",
  "carburant",
  "boiteVitesses",
  "transmission",
  "couleur",
  "portes",
  "places",
  "puissance",
  "etat",
  "premiereMain",
  "accidente",
  "wilaya",
];

export type ListingForExport = {
  category: string;
  brand: { name: string } | null;
  brandFreeText: string | null;
  model: { name: string } | null;
  modelFreeText: string | null;
  title: string;
  description: string;
  price: number;
  year: number;
  mileage: number | null;
  fuelType: string | null;
  gearbox: string | null;
  transmission: string | null;
  color: string | null;
  doors: number | null;
  seats: number | null;
  powerHp: number | null;
  condition: string;
  firstHand: boolean;
  accidented: boolean;
  wilaya: { nomFr: string };
};

export function listingToCsvRow(listing: ListingForExport): string[] {
  return [
    listing.category,
    listing.brand?.name ?? listing.brandFreeText ?? "",
    listing.model?.name ?? listing.modelFreeText ?? "",
    listing.title,
    listing.description,
    String(listing.price),
    String(listing.year),
    listing.mileage != null ? String(listing.mileage) : "",
    listing.fuelType ?? "",
    listing.gearbox ?? "",
    listing.transmission ?? "",
    listing.color ?? "",
    listing.doors !== null ? String(listing.doors) : "",
    listing.seats !== null ? String(listing.seats) : "",
    listing.powerHp !== null ? String(listing.powerHp) : "",
    listing.condition,
    listing.firstHand ? "oui" : "non",
    listing.accidented ? "oui" : "non",
    listing.wilaya.nomFr,
  ];
}
