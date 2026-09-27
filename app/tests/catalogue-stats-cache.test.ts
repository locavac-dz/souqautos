import { beforeEach, describe, expect, it, vi } from "vitest";

const aggregate = vi.fn();
const groupBy = vi.fn();
const queryRaw = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { listing: { aggregate, groupBy }, $queryRaw: queryRaw },
}));

async function loadModule() {
  vi.resetModules();
  const { resetTtlBatchCachesForTests } = await import("@/lib/ttl-cache");
  resetTtlBatchCachesForTests();
  return import("@/lib/catalogue-stats");
}

describe("catalogue-stats — cache mémoire des agrégats (Lot 227)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CATALOGUE_STATS_CACHE_TTL_MS;
    aggregate.mockResolvedValue({ _count: 3, _avg: { price: 2_500_000.4 }, _min: { price: 2_000_000 }, _max: { price: 3_000_000 } });
    groupBy.mockResolvedValue([{ brandId: 7, modelId: 9, wilayaId: 16, _count: 2, _avg: { price: 1_999_999.6 }, _min: { price: 1_500_000 } }]);
    queryRaw.mockResolvedValue([]);
  });

  it("ne relit la base qu'une fois par clé tant que la durée de vie n'est pas écoulée", async () => {
    const stats = await loadModule();
    const first = await stats.getListingStats({ brandId: 7 });
    const second = await stats.getListingStats({ brandId: 7 });
    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(first).toEqual({ count: 3, avgPrice: 2_500_000, minPrice: 2_000_000, maxPrice: 3_000_000 });
  });

  it("distingue les clés : une autre marque, un autre modèle ou une autre wilaya relit la base", async () => {
    const stats = await loadModule();
    await stats.getListingStats({ brandId: 7 });
    await stats.getListingStats({ brandId: 7, modelId: 9 });
    await stats.getListingStats({ wilayaId: 16 });
    expect(aggregate).toHaveBeenCalledTimes(3);
  });

  it("rend les Map groupées telles quelles (pas de sérialisation) et les partage entre appels", async () => {
    const stats = await loadModule();
    const brands = await stats.getListingCountsPerBrand();
    expect(brands.get(7)).toEqual({ brandId: 7, count: 2, avgPrice: 2_000_000 });
    expect(await stats.getListingCountsPerBrand()).toBe(brands);
    await stats.getModelCountsForBrand(7);
    await stats.getBrandCountsForWilaya(16);
    await stats.getListingCountsPerWilaya();
    expect(groupBy).toHaveBeenCalledTimes(4);
  });

  it("CATALOGUE_STATS_CACHE_TTL_MS=0 désactive le cache : chaque appel relit la base", async () => {
    process.env.CATALOGUE_STATS_CACHE_TTL_MS = "0";
    const stats = await loadModule();
    await stats.getListingStats({ brandId: 7 });
    await stats.getListingStats({ brandId: 7 });
    await stats.getModelPriceHistory({ brandId: 7, modelId: 9 });
    await stats.getModelPriceHistory({ brandId: 7, modelId: 9 });
    expect(aggregate).toHaveBeenCalledTimes(2);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it("une valeur illisible dans CATALOGUE_STATS_CACHE_TTL_MS retombe sur la durée par défaut (1 h)", async () => {
    process.env.CATALOGUE_STATS_CACHE_TTL_MS = "une heure";
    const stats = await loadModule();
    expect(stats.CATALOGUE_STATS_CACHE_TTL_MS).toBe(3_600_000);
    await stats.getModelYearStats({ brandId: 7, modelId: 9, year: 2020 });
    await stats.getModelYearStats({ brandId: 7, modelId: 9, year: 2020 });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});
