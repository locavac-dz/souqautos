import { beforeEach, describe, expect, it, vi } from "vitest";

const reviewGroupBy = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { review: { groupBy: (...a: unknown[]) => reviewGroupBy(...a) } },
}));

import { getSellerRatingsForSellers } from "@/lib/seller-review-service";

beforeEach(() => vi.resetAllMocks());

describe("getSellerRatingsForSellers", () => {
  it("returns empty map for empty input without DB call", async () => {
    const result = await getSellerRatingsForSellers([]);
    expect(result.size).toBe(0);
    expect(reviewGroupBy).not.toHaveBeenCalled();
  });

  it("queries groupBy with the deduplicated seller ids", async () => {
    reviewGroupBy.mockResolvedValue([]);
    await getSellerRatingsForSellers(["s1", "s1", "s2"]);
    const { where } = reviewGroupBy.mock.calls[0][0];
    expect(where.sellerId.in).toEqual(expect.arrayContaining(["s1", "s2"]));
    expect(where.sellerId.in).toHaveLength(2);
  });

  it("rounds the average to one decimal place", async () => {
    reviewGroupBy.mockResolvedValue([
      { sellerId: "s1", _avg: { rating: 4.166 }, _count: { rating: 6 } },
    ]);
    const result = await getSellerRatingsForSellers(["s1"]);
    expect(result.get("s1")?.average).toBe(4.2);
  });

  it("maps count correctly", async () => {
    reviewGroupBy.mockResolvedValue([
      { sellerId: "s1", _avg: { rating: 3.5 }, _count: { rating: 12 } },
    ]);
    const result = await getSellerRatingsForSellers(["s1"]);
    expect(result.get("s1")?.count).toBe(12);
  });

  it("omits sellers with null rating from the map", async () => {
    reviewGroupBy.mockResolvedValue([
      { sellerId: "s1", _avg: { rating: null }, _count: { rating: 0 } },
      { sellerId: "s2", _avg: { rating: 4 }, _count: { rating: 1 } },
    ]);
    const result = await getSellerRatingsForSellers(["s1", "s2"]);
    expect(result.has("s1")).toBe(false);
    expect(result.has("s2")).toBe(true);
  });

  it("omits sellers with null sellerId from the map", async () => {
    reviewGroupBy.mockResolvedValue([
      { sellerId: null, _avg: { rating: 3 }, _count: { rating: 1 } },
    ]);
    const result = await getSellerRatingsForSellers(["s1"]);
    expect(result.size).toBe(0);
  });

  it("filters out empty-string seller ids before querying", async () => {
    reviewGroupBy.mockResolvedValue([]);
    await getSellerRatingsForSellers(["", "s1"]);
    const { where } = reviewGroupBy.mock.calls[0][0];
    expect(where.sellerId.in).not.toContain("");
  });
});
