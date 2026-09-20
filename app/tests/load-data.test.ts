import { describe, expect, it } from "vitest";
import { createListingGenerator, mulberry32, weightedPicker, zipfWeights, type Catalogue } from "../scripts/load-data";

const catalogue: Catalogue = {
  models: [
    { id: 1, brandId: 1, name: "Clio", brandName: "Renault", categories: ["VOITURE"] },
    { id: 2, brandId: 1, name: "Kangoo", brandName: "Renault", categories: ["VOITURE", "UTILITAIRE"] },
    { id: 3, brandId: 2, name: "208", brandName: "Peugeot", categories: ["VOITURE"] },
    { id: 4, brandId: 3, name: "MT-07", brandName: "Yamaha", categories: ["DEUX_ROUES"] },
    { id: 5, brandId: 4, name: "Actros", brandName: "Mercedes", categories: ["POIDS_LOURD"] },
    ...Array.from({ length: 40 }, (_, i) => ({ id: 10 + i, brandId: 9, name: `Rare ${i}`, brandName: "Marque", categories: ["VOITURE"] })),
  ],
  wilayaIds: Array.from({ length: 58 }, (_, i) => i + 1),
  communesByWilaya: new Map([[16, [1601, 1602, 1603]]]),
  equipmentIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
};
const NOW = Date.parse("2026-09-20T12:00:00Z");
const sellers = Array.from({ length: 50 }, (_, i) => `vendeur-${i + 1}`);
const generate = (seed = 137) => createListingGenerator({ catalogue, sellerIds: sellers, now: NOW, seed });
const many = (n: number, seed?: number) => {
  const g = generate(seed);
  return Array.from({ length: n }, (_, i) => g(i));
};

describe("outils de tirage", () => {
  it("mulberry32 est déterministe et reste dans [0, 1[", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it("le tirage pondéré respecte les poids", () => {
    const rand = mulberry32(3);
    const pick = weightedPicker(["a", "b", "c"] as const, [90, 9, 1]);
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 10_000; i++) counts[pick(rand)] += 1;
    expect(counts.a).toBeGreaterThan(8_500);
    expect(counts.b).toBeGreaterThan(500);
    expect(counts.c).toBeLessThan(300);
  });
  it("Zipf décroît", () => {
    const w = zipfWeights(5);
    expect(w[0]).toBe(1);
    for (let i = 1; i < w.length; i++) expect(w[i]).toBeLessThan(w[i - 1]);
  });
});

describe("createListingGenerator", () => {
  it("est reproductible : même graine, mêmes annonces ; graine différente, autres annonces", () => {
    const strip = (rows: ReturnType<typeof many>) => JSON.stringify(rows);
    expect(strip(many(200, 5))).toBe(strip(many(200, 5)));
    expect(strip(many(200, 5))).not.toBe(strip(many(200, 6)));
  });

  it("produit des annonces valides : bornes, cohérence marque/modèle/catégorie, identifiants uniques", () => {
    const rows = many(3000);
    expect(new Set(rows.map((r) => r.listing.id)).size).toBe(rows.length);
    for (const { listing: l, photoCount, equipmentIds } of rows) {
      const model = catalogue.models.find((m) => m.id === l.modelId)!;
      expect(model.brandId).toBe(l.brandId);
      expect(model.categories, `${l.title} (${l.category})`).toContain(l.category);
      expect(l.price).toBeGreaterThanOrEqual(50_000);
      expect(l.year).toBeLessThanOrEqual(2026);
      expect(l.year).toBeGreaterThanOrEqual(2026 - 26);
      expect(l.mileage).toBeGreaterThanOrEqual(0);
      if (l.condition === "NEUF") expect(l.mileage).toBe(0);
      expect(l.title).toContain(model.name);
      expect(l.title).toContain(String(l.year));
      expect(sellers).toContain(l.sellerId);
      expect(catalogue.wilayaIds).toContain(l.wilayaId);
      if (l.communeId !== null) expect(catalogue.communesByWilaya.get(l.wilayaId)).toContain(l.communeId);
      expect(photoCount).toBeGreaterThanOrEqual(1);
      expect(photoCount).toBeLessThanOrEqual(8);
      expect(new Set(equipmentIds).size).toBe(equipmentIds.length);
      for (const id of equipmentIds) expect(catalogue.equipmentIds).toContain(id);
      if (l.category === "DEUX_ROUES") expect(l.fuelType).toBe("ESSENCE");
    }
  });

  it("les dates suivent le statut : brouillon et en attente non publiées ; les autres publiées, expirant 60 jours après", () => {
    for (const { listing: l } of many(3000)) {
      if (l.status === "BROUILLON" || l.status === "EN_ATTENTE") {
        expect(l.publishedAt).toBeNull();
        expect(l.expiresAt).toBeNull();
      } else {
        expect(l.publishedAt).not.toBeNull();
        expect(l.expiresAt!.getTime() - l.publishedAt!.getTime()).toBe(60 * 24 * 3600 * 1000);
        expect(l.publishedAt!.getTime()).toBeLessThanOrEqual(NOW);
      }
      expect(l.createdAt.getTime()).toBeLessThanOrEqual(l.publishedAt?.getTime() ?? NOW);
    }
  });

  it("a la FORME d'un vrai marché : majorité publiée et de voitures, modèles populaires dominants, gros vendeurs, grandes wilayas", () => {
    const rows = many(20_000).map((r) => r.listing);
    const share = (predicate: (l: (typeof rows)[number]) => boolean) => rows.filter(predicate).length / rows.length;
    expect(share((l) => l.status === "PUBLIEE")).toBeGreaterThan(0.78);
    expect(share((l) => l.status === "PUBLIEE")).toBeLessThan(0.86);
    expect(share((l) => l.category === "VOITURE")).toBeGreaterThan(0.72);
    expect(share((l) => l.category === "DEUX_ROUES")).toBeGreaterThan(0.05);
    // Le modèle populaire écrase les modèles rares : c'est ce qui rend « Renault Clio » coûteux et « Rare 39 » anecdotique.
    const byModel = new Map<number, number>();
    for (const l of rows) byModel.set(l.modelId, (byModel.get(l.modelId) ?? 0) + 1);
    expect(byModel.get(1)!).toBeGreaterThan(10 * (byModel.get(49) ?? 1));
    // Un gros vendeur en publie des centaines ; le dernier, quelques-unes.
    const bySeller = new Map<string, number>();
    for (const l of rows) bySeller.set(l.sellerId, (bySeller.get(l.sellerId) ?? 0) + 1);
    expect(bySeller.get("vendeur-1")!).toBeGreaterThan(rows.length * 0.1);
    expect(bySeller.get("vendeur-1")!).toBeGreaterThan(20 * (bySeller.get("vendeur-50") ?? 1));
    // Alger (16) pèse bien plus qu'une petite wilaya.
    expect(rows.filter((l) => l.wilayaId === 16).length).toBeGreaterThan(5 * rows.filter((l) => l.wilayaId === 40).length);
  });

  it("l'âge, le kilométrage et le prix se tiennent : plus vieux = plus de kilomètres et moins cher", () => {
    const cars = many(20_000).map((r) => r.listing).filter((l) => l.category === "VOITURE" && l.condition === "OCCASION");
    const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    const recent = cars.filter((l) => l.year >= 2022);
    const old = cars.filter((l) => l.year <= 2012);
    expect(recent.length).toBeGreaterThan(100);
    expect(old.length).toBeGreaterThan(100);
    expect(mean(old.map((l) => l.mileage))).toBeGreaterThan(2 * mean(recent.map((l) => l.mileage)));
    expect(mean(old.map((l) => l.price))).toBeLessThan(0.6 * mean(recent.map((l) => l.price)));
  });

  it("refuse un catalogue vide au lieu de produire des annonces sans modèle", () => {
    expect(() => createListingGenerator({ catalogue: { ...catalogue, models: [] }, sellerIds: sellers, now: NOW })).toThrow(/catalogue/i);
  });
});
