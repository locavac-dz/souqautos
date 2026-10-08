import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ListingCategory } from "@prisma/client";

const brandFindUnique = vi.fn();
const modelFindUnique = vi.fn();
const modelCount = vi.fn();
const generationFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: { findUnique: (...a: unknown[]) => brandFindUnique(...a) },
    model: { findUnique: (...a: unknown[]) => modelFindUnique(...a), count: (...a: unknown[]) => modelCount(...a) },
    generation: { findUnique: (...a: unknown[]) => generationFindUnique(...a) },
  },
}));

import {
  brandCategories,
  categoryFromSlug,
  categorySlug,
  CATALOGUE_CATEGORIES,
  filterCatalogueByCategory,
  isCatalogueCategory,
  LISTING_CATEGORIES,
  modelInCategory,
  normalizeModelCategories,
} from "@/lib/vehicle-catalogue";
import { validateVehicleRefs } from "@/lib/listing-catalogue-refs";
import { catalogue, modelCategories, slugify } from "../prisma/catalogue-data";
import { validateCatalogueName } from "@/lib/catalogue-admin";

const m = (id: number, ...categories: ListingCategory[]) => ({ id, name: `m${id}`, categories });
const brands = [
  { id: 1, name: "Renault", models: [m(10, "VOITURE"), m(11, "VOITURE", "UTILITAIRE"), m(12, "UTILITAIRE")] },
  { id: 2, name: "Yamaha", models: [m(20, "DEUX_ROUES"), m(21, "DEUX_ROUES")] },
  { id: 3, name: "Scania", models: [m(30, "POIDS_LOURD")] },
];

describe("catégories du catalogue", () => {
  it("has four catalogue families, and « AUTRE » and « EQUIPEMENT » are listing categories without a catalogue", () => {
    expect(CATALOGUE_CATEGORIES).toEqual(["VOITURE", "UTILITAIRE", "POIDS_LOURD", "DEUX_ROUES"]);
    expect(LISTING_CATEGORIES).toEqual([...CATALOGUE_CATEGORIES, "AUTRE", "EQUIPEMENT"]);
    expect(isCatalogueCategory("AUTRE")).toBe(false);
    expect(isCatalogueCategory("EQUIPEMENT")).toBe(false);
    expect(isCatalogueCategory("VOITURE")).toBe(true);
    expect(isCatalogueCategory(undefined)).toBe(false);
  });

  it("offers a model only in the categories it declares", () => {
    expect(modelInCategory(m(1, "VOITURE", "UTILITAIRE"), "UTILITAIRE")).toBe(true);
    expect(modelInCategory(m(1, "VOITURE"), "UTILITAIRE")).toBe(false);
    expect(modelInCategory(m(1, "DEUX_ROUES"), "VOITURE")).toBe(false);
  });

  it("offers everything when no category is chosen, or for « AUTRE »", () => {
    expect(modelInCategory(m(1, "DEUX_ROUES"), undefined)).toBe(true);
    expect(modelInCategory(m(1, "DEUX_ROUES"), null)).toBe(true);
    expect(modelInCategory(m(1, "DEUX_ROUES"), "AUTRE")).toBe(true);
  });

  it("keeps only brands that have a model in the category, reduced to those models", () => {
    const utilitaires = filterCatalogueByCategory(brands, "UTILITAIRE");
    expect(utilitaires.map((b) => b.name)).toEqual(["Renault"]);
    expect(utilitaires[0].models.map((x) => x.id)).toEqual([11, 12]);

    const voitures = filterCatalogueByCategory(brands, "VOITURE");
    expect(voitures[0].models.map((x) => x.id)).toEqual([10, 11]);

    expect(filterCatalogueByCategory(brands, "DEUX_ROUES").map((b) => b.name)).toEqual(["Yamaha"]);
    expect(filterCatalogueByCategory(brands, "POIDS_LOURD").map((b) => b.name)).toEqual(["Scania"]);
  });

  it("does not mutate the brands it filters, and returns every brand without a category", () => {
    const before = JSON.stringify(brands);
    filterCatalogueByCategory(brands, "UTILITAIRE");
    expect(JSON.stringify(brands)).toBe(before);
    expect(filterCatalogueByCategory(brands, undefined)).toHaveLength(3);
    expect(filterCatalogueByCategory(brands, "AUTRE")).toHaveLength(3);
  });

  it("derives a brand's families from its models, in canonical order", () => {
    expect(brandCategories(brands[0].models)).toEqual(["VOITURE", "UTILITAIRE"]);
    expect(brandCategories(brands[2].models)).toEqual(["POIDS_LOURD"]);
    expect(brandCategories([])).toEqual([]);
  });

  it("round-trips the readable address of a category filter, and ignores anything else", () => {
    for (const category of CATALOGUE_CATEGORIES) expect(categoryFromSlug(categorySlug(category))).toBe(category);
    expect(categorySlug("POIDS_LOURD")).toBe("poids-lourd");
    expect(categoryFromSlug("camion")).toBeUndefined();
    expect(categoryFromSlug("VOITURE")).toBeUndefined();
    expect(categoryFromSlug(["voiture", "utilitaire"])).toBeUndefined();
    expect(categoryFromSlug(undefined)).toBeUndefined();
  });

  it("validates the categories an administrator submits", () => {
    expect(normalizeModelCategories(["UTILITAIRE", "VOITURE"])).toEqual(["VOITURE", "UTILITAIRE"]);
    expect(normalizeModelCategories(["VOITURE", "VOITURE"])).toEqual(["VOITURE"]);
    expect(normalizeModelCategories([])).toBeNull();
    expect(normalizeModelCategories(["AUTRE"])).toBeNull();
    expect(normalizeModelCategories(["VOITURE", "CAMION"])).toBeNull();
    expect(normalizeModelCategories("VOITURE")).toBeNull();
    expect(normalizeModelCategories(undefined)).toBeNull();
  });
});

describe("validateVehicleRefs — catégorie de l'annonce", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    brandFindUnique.mockResolvedValue({ id: 1 });
  });

  it("rejects a model that does not exist in the listing's category", async () => {
    modelFindUnique.mockResolvedValue({ id: 10, brandId: 1, categories: ["VOITURE"] });
    expect(await validateVehicleRefs({ category: "DEUX_ROUES", brandId: 1, modelId: 10 })).toEqual({ ok: false, error: "wrong_category" });
  });

  it("accepts a model that declares the category, including a dual-use model", async () => {
    modelFindUnique.mockResolvedValue({ id: 11, brandId: 1, categories: ["VOITURE", "UTILITAIRE"] });
    expect(await validateVehicleRefs({ category: "UTILITAIRE", brandId: 1, modelId: 11 })).toEqual({ ok: true });
    expect(await validateVehicleRefs({ category: "VOITURE", brandId: 1, modelId: 11 })).toEqual({ ok: true });
  });

  it("accepts anything for « AUTRE » and when the caller gives no category (essais, revues de presse)", async () => {
    modelFindUnique.mockResolvedValue({ id: 20, brandId: 2, categories: ["DEUX_ROUES"] });
    brandFindUnique.mockResolvedValue({ id: 2 });
    expect(await validateVehicleRefs({ category: "AUTRE", brandId: 2, modelId: 20 })).toEqual({ ok: true });
    expect(await validateVehicleRefs({ brandId: 2, modelId: 20 })).toEqual({ ok: true });
  });

  it("checks a brand chosen without a model: it must have a model in the category", async () => {
    modelCount.mockResolvedValue(0);
    expect(await validateVehicleRefs({ category: "POIDS_LOURD", brandId: 1 })).toEqual({ ok: false, error: "wrong_category" });
    expect(modelCount).toHaveBeenCalledWith({ where: { brandId: 1, categories: { has: "POIDS_LOURD" } } });

    modelCount.mockResolvedValue(3);
    expect(await validateVehicleRefs({ category: "UTILITAIRE", brandId: 1 })).toEqual({ ok: true });
  });

  it("still reports an unknown model or brand before a category mismatch", async () => {
    brandFindUnique.mockResolvedValue(null);
    expect(await validateVehicleRefs({ category: "VOITURE", brandId: 99 })).toEqual({ ok: false, error: "unknown_brand" });
    brandFindUnique.mockResolvedValue({ id: 1 });
    modelFindUnique.mockResolvedValue(null);
    expect(await validateVehicleRefs({ category: "VOITURE", brandId: 1, modelId: 99 })).toEqual({ ok: false, error: "unknown_model" });
  });

  it("does not query models by category for a free-text vehicle (no brandId)", async () => {
    expect(await validateVehicleRefs({ category: "DEUX_ROUES" })).toEqual({ ok: true });
    expect(modelCount).not.toHaveBeenCalled();
  });
});

describe("données du catalogue (utilitaires, poids lourds, deux-roues)", () => {
  const rows = catalogue.flatMap((entry) =>
    entry.models.map((model) => ({
      brand: entry.brand,
      name: typeof model === "string" ? model : model.name,
      categories: modelCategories(entry, model),
    }))
  );
  const inCategory = (category: ListingCategory) => rows.filter((r) => r.categories.includes(category));
  const brandsIn = (category: ListingCategory) => new Set(inCategory(category).map((r) => r.brand));

  it("gives every model at least one catalogue category, without duplicates or « AUTRE »", () => {
    for (const row of rows) {
      expect(row.categories.length, `${row.brand} ${row.name}`).toBeGreaterThan(0);
      expect(new Set(row.categories).size, `${row.brand} ${row.name}`).toBe(row.categories.length);
      for (const category of row.categories) expect(isCatalogueCategory(category), `${row.brand} ${row.name}`).toBe(true);
    }
  });

  it("covers each family with a substantial list (guards against a truncated catalogue)", () => {
    expect(brandsIn("VOITURE").size).toBeGreaterThanOrEqual(24);
    expect(brandsIn("UTILITAIRE").size).toBeGreaterThanOrEqual(25);
    expect(brandsIn("POIDS_LOURD").size).toBeGreaterThanOrEqual(15);
    expect(brandsIn("DEUX_ROUES").size).toBeGreaterThanOrEqual(20);
  });

  it("never mixes a two-wheeler with a four-wheeler in the same model", () => {
    for (const row of inCategory("DEUX_ROUES")) expect(row.categories, `${row.brand} ${row.name}`).toEqual(["DEUX_ROUES"]);
  });

  it("only lets two brands sell both cars and motorcycles: Suzuki and BMW", () => {
    const bikeBrands = brandsIn("DEUX_ROUES");
    const carBrands = new Set([...brandsIn("VOITURE"), ...brandsIn("UTILITAIRE"), ...brandsIn("POIDS_LOURD")]);
    expect([...bikeBrands].filter((b) => carBrands.has(b)).sort()).toEqual(["BMW", "Suzuki"]);
  });

  it("keeps every existing car model available as a car (no regression on the demo listings)", () => {
    const demoModels: [string, string][] = [
      ["Renault", "Clio"], ["Renault", "Megane"], ["Dacia", "Duster"], ["Dacia", "Sandero"], ["Volkswagen", "Golf"], ["Volkswagen", "Passat"],
      ["Peugeot", "208"], ["Hyundai", "Tucson"], ["Hyundai", "Elantra"], ["Toyota", "Yaris"], ["Toyota", "Corolla"], ["Kia", "Sportage"],
      ["Fiat", "Tipo"], ["Seat", "Ibiza"], ["Citroën", "C4"], ["Suzuki", "Vitara"], ["Skoda", "Octavia"], ["Ford", "Fiesta"],
      ["Nissan", "Qashqai"], ["Chery", "Tiggo 7"], ["Opel", "Corsa"], ["BMW", "Série 3"], ["Mercedes-Benz", "Classe C"], ["Audi", "Q3"],
    ];
    for (const [brand, name] of demoModels) {
      const row = rows.find((r) => r.brand === brand && r.name === name);
      expect(row, `${brand} ${name}`).toBeDefined();
      expect(row!.categories, `${brand} ${name}`).toContain("VOITURE");
    }
  });

  it("classifies the vans and pick-ups that were listed as cars, and keeps the ambiguous ones in both", () => {
    const find = (brand: string, name: string) => rows.find((r) => r.brand === brand && r.name === name)!.categories;
    expect(find("Mercedes-Benz", "Sprinter")).toEqual(["UTILITAIRE"]);
    expect(find("Renault", "Kangoo")).toEqual(["VOITURE", "UTILITAIRE"]);
    expect(find("Toyota", "Hilux")).toEqual(["VOITURE", "UTILITAIRE"]);
    expect(find("Ford", "Ranger")).toEqual(["VOITURE", "UTILITAIRE"]);
    expect(find("Mitsubishi", "L200")).toEqual(["VOITURE", "UTILITAIRE"]);
    expect(find("Peugeot", "Partner")).toEqual(["VOITURE", "UTILITAIRE"]);
    expect(find("Citroën", "Berlingo")).toEqual(["VOITURE", "UTILITAIRE"]);
    expect(find("Mercedes-Benz", "Actros")).toEqual(["POIDS_LOURD"]);
    expect(find("Yamaha", "MT-07")).toEqual(["DEUX_ROUES"]);
  });

  it("has unique brand slugs, and unique model slugs inside each brand", () => {
    const brandSlugs = catalogue.map((entry) => slugify(entry.brand));
    expect(new Set(brandSlugs).size).toBe(brandSlugs.length);
    for (const entry of catalogue) {
      const slugs = entry.models.map((model) => slugify(typeof model === "string" ? model : model.name));
      expect(new Set(slugs).size, entry.brand).toBe(slugs.length);
      expect(slugs.every(Boolean), entry.brand).toBe(true);
    }
  });

  it("only uses names that the administration form would accept (2 to 60 characters)", () => {
    for (const row of rows) {
      expect(validateCatalogueName(row.brand).ok, row.brand).toBe(true);
      expect(validateCatalogueName(row.name).ok, `${row.brand} ${row.name}`).toBe(true);
    }
  });

  it("gives every brand at least one model", () => {
    for (const entry of catalogue) expect(entry.models.length, entry.brand).toBeGreaterThan(0);
  });

  it("includes the Algerian truck maker SNVI, with its verified range", () => {
    const snvi = rows.filter((r) => r.brand === "SNVI").map((r) => r.name);
    expect(snvi).toEqual(expect.arrayContaining(["K66", "K120", "B260", "C260", "M230"]));
  });
});
