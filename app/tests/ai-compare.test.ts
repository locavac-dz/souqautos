import { describe, expect, it } from "vitest";
import { computeCompareHighlights, type ComparableListingFacts } from "@/lib/ai-compare";

function makeListing(overrides: Partial<ComparableListingFacts> & { id: string }): ComparableListingFacts {
  return {
    price: 2_000_000,
    mileage: 50_000,
    year: 2019,
    powerHp: 90,
    trustScore: 60,
    ...overrides,
  };
}

describe("computeCompareHighlights", () => {
  it("returns all-null highlights when fewer than 2 listings are given", () => {
    const result = computeCompareHighlights([makeListing({ id: "a" })]);
    expect(result).toEqual({
      cheapestId: null,
      lowestMileageId: null,
      newestId: null,
      mostPowerfulId: null,
      mostTrustedId: null,
    });
  });

  it("identifies the cheapest, lowest-mileage and newest listing", () => {
    const listings = [
      makeListing({ id: "a", price: 3_000_000, mileage: 80_000, year: 2017 }),
      makeListing({ id: "b", price: 2_000_000, mileage: 20_000, year: 2021 }),
      makeListing({ id: "c", price: 2_500_000, mileage: 50_000, year: 2019 }),
    ];
    const result = computeCompareHighlights(listings);
    expect(result.cheapestId).toBe("b");
    expect(result.lowestMileageId).toBe("b");
    expect(result.newestId).toBe("b");
  });

  it("identifies the most powerful listing when every listing has a power value", () => {
    const listings = [
      makeListing({ id: "a", powerHp: 90 }),
      makeListing({ id: "b", powerHp: 150 }),
    ];
    expect(computeCompareHighlights(listings).mostPowerfulId).toBe("b");
  });

  it("never ranks power when at least one listing lacks the data", () => {
    const listings = [makeListing({ id: "a", powerHp: 90 }), makeListing({ id: "b", powerHp: null })];
    expect(computeCompareHighlights(listings).mostPowerfulId).toBeNull();
  });

  it("identifies the most trusted seller when every listing has trust data", () => {
    const listings = [
      makeListing({ id: "a", trustScore: 40 }),
      makeListing({ id: "b", trustScore: 85 }),
    ];
    expect(computeCompareHighlights(listings).mostTrustedId).toBe("b");
  });

  it("never ranks trust when at least one listing lacks the data", () => {
    const listings = [makeListing({ id: "a", trustScore: 40 }), makeListing({ id: "b", trustScore: null })];
    expect(computeCompareHighlights(listings).mostTrustedId).toBeNull();
  });
});
