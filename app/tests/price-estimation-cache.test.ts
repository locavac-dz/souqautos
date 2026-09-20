import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { listing: { findMany: (...args: unknown[]) => findMany(...args) } } }));

import { COMPARABLES_TTL_MS, estimateFromRows, estimatePrice, estimatePricesForListings, indexComparables } from "@/lib/price-estimation";
import { invalidateReferenceData } from "@/lib/reference-data";

// Lot 137 — les comparables de prix d'un modèle sont gardés 60 s en mémoire au lieu d'être rechargés à chaque page (ils
// pesaient plus de la moitié du travail du serveur sur la recherche). Ces tests prouvent les DEUX moitiés du contrat : la base
// n'est plus relue, ET le résultat est exactement celui du calcul direct.

const rows = [
  { id: "a", price: 1_500_000, year: 2019, mileage: 60_000, wilayaId: 16, equipments: [{ equipmentId: 1 }, { equipmentId: 2 }] },
  { id: "b", price: 1_700_000, year: 2020, mileage: 50_000, wilayaId: 16, equipments: [{ equipmentId: 1 }] },
  { id: "c", price: 1_200_000, year: 2016, mileage: 140_000, wilayaId: 31, equipments: [] },
  { id: "d", price: 1_900_000, year: 2021, mileage: 30_000, wilayaId: 16, equipments: [{ equipmentId: 1 }, { equipmentId: 3 }] },
];
const flat = rows.map(({ equipments, ...r }) => ({ ...r, equipmentIds: equipments.map((e) => e.equipmentId) }));
const listing = (over: Partial<{ id: string; brandId: number | null; modelId: number | null; year: number; mileage: number; wilayaId: number; equipmentIds: number[] }> = {}) => ({
  id: "x", brandId: 1, modelId: 2, year: 2019, mileage: 58_000, wilayaId: 16, equipmentIds: [1], ...over,
});

beforeEach(() => {
  invalidateReferenceData();
  findMany.mockReset().mockResolvedValue(rows);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-20T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("estimatePricesForListings — comparables en cache", () => {
  it("donne exactement le résultat du calcul direct sur les mêmes lignes", async () => {
    const listings = [listing({ id: "x1" }), listing({ id: "x2", year: 2016, mileage: 150_000, wilayaId: 31, equipmentIds: [] }), listing({ id: "x3", year: 2000, mileage: 900_000 })];
    const cached = await estimatePricesForListings(listings);
    for (const l of listings) expect(cached.get(l.id), l.id).toEqual(estimateFromRows(flat, { year: l.year, mileage: l.mileage, wilayaId: l.wilayaId, equipmentIds: l.equipmentIds, excludeListingId: l.id }));
  });

  it("ne lit la base qu'UNE fois par couple marque/modèle, pour toutes les annonces et toutes les visites suivantes", async () => {
    await estimatePricesForListings([listing({ id: "x1" }), listing({ id: "x2" }), listing({ id: "x3", brandId: 5, modelId: 9 })]);
    expect(findMany).toHaveBeenCalledTimes(2); // deux couples distincts
    await estimatePricesForListings([listing({ id: "x1" }), listing({ id: "x4" })]);
    await estimatePrice({ brandId: 1, modelId: 2, year: 2019 });
    expect(findMany).toHaveBeenCalledTimes(2); // aucune lecture de plus
  });

  it("relit la base après 60 secondes (une annonce publiée ou vendue finit par compter)", async () => {
    expect((await estimatePrice({ brandId: 1, modelId: 2, year: 2019 }))?.sampleSize).toBe(3); // 2019 ± 2 ans : a, b, d
    vi.setSystemTime(Date.now() + COMPARABLES_TTL_MS - 1000);
    await estimatePrice({ brandId: 1, modelId: 2 });
    expect(findMany).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 2000);
    findMany.mockResolvedValue([...rows, { id: "e", price: 500_000, year: 2019, mileage: 60_000, wilayaId: 16, equipments: [] }]);
    const fresh = await estimatePrice({ brandId: 1, modelId: 2, year: 2019 });
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(fresh?.sampleSize).toBe(4); // la nouvelle annonce (2019) est comptée
  });

  it("garde un couple par clé : deux modèles ne se mélangent pas", async () => {
    findMany.mockImplementation(async (args: { where: { modelId: number } }) => (args.where.modelId === 2 ? rows : [{ id: "z", price: 9_000_000, year: 2022, mileage: 1000, wilayaId: 16, equipments: [] }]));
    const [a, b] = [await estimatePrice({ brandId: 1, modelId: 2 }), await estimatePrice({ brandId: 1, modelId: 3 })];
    expect(a?.sampleSize).toBe(4);
    expect(b?.sampleSize).toBe(1);
  });

  it("n'interroge rien pour une annonce sans marque ni modèle du catalogue, et l'exclut de ses propres comparables", async () => {
    const result = await estimatePricesForListings([listing({ id: "libre", brandId: null, modelId: null })]);
    expect(result.get("libre")).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
    const own = await estimatePricesForListings([listing({ id: "a", year: 2019, mileage: 60_000, wilayaId: 16, equipmentIds: [1, 2] })]);
    expect(own.get("a")).toEqual(estimateFromRows(flat, { year: 2019, mileage: 60_000, wilayaId: 16, equipmentIds: [1, 2], excludeListingId: "a" }));
  });

  it("range les comparables par année, et la valeur partagée est GELÉE jusqu'aux tranches (personne ne peut la modifier)", async () => {
    const built = indexComparables(flat);
    expect(Object.keys(built)).toEqual(["all", "byYear"]);
    expect(Object.keys(built.byYear).map(Number).sort()).toEqual([2016, 2019, 2020, 2021]);
    expect(built.byYear[2019]?.map((r) => r.id)).toEqual(["a"]);
    expect(built.all).toHaveLength(4);
    // Le gel du cache (src/lib/reference-data.ts) doit atteindre les TRANCHES : sinon une page pourrait corrompre les
    // estimations de toutes les autres. Vérifié sur une valeur réellement passée par le cache (clé neuve).
    const cached = (await import("@/lib/reference-data")).cachedReference;
    const shared = await cached("comparables-gel-test", async () => built);
    expect(Object.isFrozen(shared)).toBe(true);
    expect(Object.isFrozen(shared.all)).toBe(true);
    expect(Object.isFrozen(shared.byYear)).toBe(true);
    expect(Object.isFrozen(shared.byYear[2019])).toBe(true);
    expect(() => shared.byYear[2019]!.push(flat[0])).toThrow(TypeError);
  });

  it("ne garde pas un échec de la base : l'appel suivant réessaie", async () => {
    findMany.mockRejectedValueOnce(new Error("base indisponible"));
    await expect(estimatePrice({ brandId: 1, modelId: 2 })).rejects.toThrow("base indisponible");
    expect((await estimatePrice({ brandId: 1, modelId: 2 }))?.sampleSize).toBe(4);
  });
});
