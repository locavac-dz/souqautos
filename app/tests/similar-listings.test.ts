import { beforeEach, describe, expect, it, vi } from "vitest";

const listingFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { listing: { findMany: (...a: unknown[]) => listingFindMany(...a) } },
}));
vi.mock("@/lib/search", () => ({
  listingCardInclude: { brand: true, model: true },
}));

import { getSimilarListings } from "@/lib/similar-listings";

const BASE = { excludeId: "l1", brandId: 1, modelId: 10, price: 1_000_000 };

const makeListings = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `l${i + 2}` }));

beforeEach(() => vi.resetAllMocks());

describe("getSimilarListings", () => {
  it("returns [] immediately when brandId is null", async () => {
    const result = await getSimilarListings({ ...BASE, brandId: null });
    expect(result).toEqual([]);
    expect(listingFindMany).not.toHaveBeenCalled();
  });

  it("returns by-model results when there are >= 3 matches", async () => {
    listingFindMany.mockResolvedValueOnce(makeListings(4));
    const result = await getSimilarListings(BASE);
    expect(result).toHaveLength(4);
    expect(listingFindMany).toHaveBeenCalledOnce();
    const where = listingFindMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ brandId: 1, modelId: 10, id: { not: "l1" } });
  });

  it("completes with same-brand listings when fewer than 3 by-model results", async () => {
    listingFindMany
      .mockResolvedValueOnce(makeListings(2))   // by-model
      .mockResolvedValueOnce(makeListings(4));   // by-brand fill
    const result = await getSimilarListings(BASE);
    expect(result).toHaveLength(6);
    expect(listingFindMany).toHaveBeenCalledTimes(2);
    const fill = listingFindMany.mock.calls[1][0];
    // fill excludes the two already found + excludeId, and filters by price band
    expect(fill.where.modelId).toEqual({ not: 10 });
    expect(fill.where.price).toBeDefined();
  });

  it("uses price band ±30% for the brand-level query", async () => {
    listingFindMany
      .mockResolvedValueOnce(makeListings(1))
      .mockResolvedValueOnce([]);
    await getSimilarListings({ ...BASE, price: 1_000_000 });
    const priceFilter = listingFindMany.mock.calls[1][0].where.price;
    expect(priceFilter.gte).toBe(700_000);  // 1M × 0.7
    expect(priceFilter.lte).toBe(1_300_000); // 1M × 1.3
  });

  it("falls back to brand+price query when modelId is null", async () => {
    listingFindMany.mockResolvedValueOnce(makeListings(3));
    const result = await getSimilarListings({ ...BASE, modelId: null });
    expect(result).toHaveLength(3);
    expect(listingFindMany).toHaveBeenCalledOnce();
    const where = listingFindMany.mock.calls[0][0].where;
    expect(where.brandId).toBe(1);
    expect(where.modelId).toBeUndefined();
  });

  it("excludes the current listing id in fallback query", async () => {
    listingFindMany.mockResolvedValueOnce([]);
    await getSimilarListings({ ...BASE, modelId: null });
    const where = listingFindMany.mock.calls[0][0].where;
    expect(where.id).toEqual({ not: "l1" });
  });

  it("takes at most LIMIT=6 results in model query", async () => {
    listingFindMany.mockResolvedValueOnce(makeListings(10));
    await getSimilarListings(BASE);
    expect(listingFindMany.mock.calls[0][0].take).toBe(6);
  });
});
