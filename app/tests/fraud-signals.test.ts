import { describe, expect, it } from "vitest";
import {
  detectDuplicatePhoto,
  detectLowPrice,
  detectSellerRejectionHistory,
  LOW_PRICE_RATIO,
  MIN_REJECTIONS_FOR_SIGNAL,
} from "@/lib/fraud-signals";
import type { EstimateResult } from "@/lib/price-estimation";

describe("detectDuplicatePhoto", () => {
  it("flags a hash reused by a different seller", () => {
    const result = detectDuplicatePhoto(
      "seller-a",
      ["hash1", "hash2"],
      [{ sha256: "hash2", sellerId: "seller-b" }]
    );
    expect(result).toBe(true);
  });

  it("never flags the seller's own reused photos", () => {
    const result = detectDuplicatePhoto(
      "seller-a",
      ["hash1"],
      [{ sha256: "hash1", sellerId: "seller-a" }]
    );
    expect(result).toBe(false);
  });

  it("ignores empty hashes (never-backfilled or missing files)", () => {
    const result = detectDuplicatePhoto("seller-a", [""], [{ sha256: "", sellerId: "seller-b" }]);
    expect(result).toBe(false);
  });

  it("returns false when no hash matches any other seller", () => {
    const result = detectDuplicatePhoto(
      "seller-a",
      ["hash1"],
      [{ sha256: "hash-unrelated", sellerId: "seller-b" }]
    );
    expect(result).toBe(false);
  });
});

describe("detectLowPrice", () => {
  const baseEstimate: EstimateResult = {
    low: 2_000_000,
    mid: 2_500_000,
    high: 3_000_000,
    sampleSize: 5,
    confidencePct: 60,
    confidenceLabel: "bonne",
    appliedFilters: { year: true, mileage: true, wilaya: false, equipment: false },
  };

  it("flags a price far below the lowest comparable", () => {
    expect(detectLowPrice(900_000, baseEstimate)).toBe(true);
  });

  it("does not flag a price just below the estimate range (legitimate bonne affaire)", () => {
    expect(detectLowPrice(1_800_000, baseEstimate)).toBe(false);
  });

  it("uses exactly the documented ratio as the boundary", () => {
    const boundary = baseEstimate.low * LOW_PRICE_RATIO;
    expect(detectLowPrice(boundary - 1, baseEstimate)).toBe(true);
    expect(detectLowPrice(boundary, baseEstimate)).toBe(false);
  });

  it("never flags when no estimate is available", () => {
    expect(detectLowPrice(100, null)).toBe(false);
  });

  it("never flags when the comparable sample is too small to be meaningful", () => {
    expect(detectLowPrice(100, { ...baseEstimate, sampleSize: 2 })).toBe(false);
  });
});

describe("detectSellerRejectionHistory", () => {
  it("never flags a single past rejection (an honest mistake can happen once)", () => {
    expect(detectSellerRejectionHistory(1)).toBe(false);
  });

  it("never flags a seller with no rejection history", () => {
    expect(detectSellerRejectionHistory(0)).toBe(false);
  });

  it("flags a seller at exactly the documented threshold", () => {
    expect(detectSellerRejectionHistory(MIN_REJECTIONS_FOR_SIGNAL)).toBe(true);
  });

  it("flags a seller well past the threshold", () => {
    expect(detectSellerRejectionHistory(5)).toBe(true);
  });
});
