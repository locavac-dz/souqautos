import { describe, expect, it } from "vitest";
import {
  computeListingContentHash,
  computeFraudScore,
  detectDuplicateContent,
  detectDuplicatePhoto,
  detectLowPrice,
  detectSellerRejectionHistory,
  detectVehicleInconsistency,
  FRAUD_SIGNAL_WEIGHTS,
  LOW_PRICE_RATIO,
  MIN_REJECTIONS_FOR_SIGNAL,
  NEUF_MAX_AGE_YEARS,
  NEUF_MAX_PLAUSIBLE_MILEAGE_KM,
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

describe("computeListingContentHash", () => {
  it("is deterministic for the same title and description", () => {
    const h1 = computeListingContentHash("Renault Clio 4", "Voiture en très bon état.");
    const h2 = computeListingContentHash("Renault Clio 4", "Voiture en très bon état.");
    expect(h1).toBe(h2);
  });

  it("ignores case and extra whitespace differences", () => {
    const h1 = computeListingContentHash("Renault Clio 4", "Voiture en   très bon état.");
    const h2 = computeListingContentHash("renault clio 4", "voiture en très bon état.");
    expect(h1).toBe(h2);
  });

  it("differs when the content actually differs", () => {
    const h1 = computeListingContentHash("Renault Clio 4", "Voiture en très bon état.");
    const h2 = computeListingContentHash("Renault Clio 4", "Voiture accidentée, pour pièces.");
    expect(h1).not.toBe(h2);
  });
});

describe("detectDuplicateContent", () => {
  it("flags a content hash reused by a different seller", () => {
    const result = detectDuplicateContent("seller-a", "hash1", [{ contentHash: "hash1", sellerId: "seller-b" }]);
    expect(result).toBe(true);
  });

  it("never flags the seller's own reused content", () => {
    const result = detectDuplicateContent("seller-a", "hash1", [{ contentHash: "hash1", sellerId: "seller-a" }]);
    expect(result).toBe(false);
  });

  it("ignores an empty hash (never computed)", () => {
    const result = detectDuplicateContent("seller-a", "", [{ contentHash: "", sellerId: "seller-b" }]);
    expect(result).toBe(false);
  });

  it("returns false when no other listing matches", () => {
    const result = detectDuplicateContent("seller-a", "hash1", [{ contentHash: "hash-unrelated", sellerId: "seller-b" }]);
    expect(result).toBe(false);
  });
});

describe("detectVehicleInconsistency", () => {
  const CURRENT_YEAR = 2026;

  it("never flags an OCCASION listing, regardless of mileage/year", () => {
    expect(detectVehicleInconsistency("OCCASION", 300_000, 1990, CURRENT_YEAR)).toBe(false);
  });

  it("never flags a genuinely new car (low mileage, recent year)", () => {
    expect(detectVehicleInconsistency("NEUF", 50, CURRENT_YEAR, CURRENT_YEAR)).toBe(false);
  });

  it("flags a car declared NEUF with implausible mileage", () => {
    expect(detectVehicleInconsistency("NEUF", NEUF_MAX_PLAUSIBLE_MILEAGE_KM + 1, CURRENT_YEAR, CURRENT_YEAR)).toBe(
      true
    );
  });

  it("uses exactly the documented mileage threshold as the boundary", () => {
    expect(detectVehicleInconsistency("NEUF", NEUF_MAX_PLAUSIBLE_MILEAGE_KM, CURRENT_YEAR, CURRENT_YEAR)).toBe(
      false
    );
  });

  it("flags a car declared NEUF but too old to still be unsold", () => {
    const tooOld = CURRENT_YEAR - NEUF_MAX_AGE_YEARS - 1;
    expect(detectVehicleInconsistency("NEUF", 0, tooOld, CURRENT_YEAR)).toBe(true);
  });

  it("uses exactly the documented age threshold as the boundary", () => {
    const stillPlausible = CURRENT_YEAR - NEUF_MAX_AGE_YEARS;
    expect(detectVehicleInconsistency("NEUF", 0, stillPlausible, CURRENT_YEAR)).toBe(false);
  });
});

describe("computeFraudScore", () => {
  const noSignals = {
    duplicatePhoto: false,
    duplicateContent: false,
    duplicateVin: false,
    lowPrice: false,
    vehicleInconsistency: false,
    sellerRejectionHistory: false,
  };

  it("returns 0 when no signal fires", () => {
    expect(computeFraudScore(noSignals)).toBe(0);
  });

  it("returns the exact weight for a single signal", () => {
    expect(computeFraudScore({ ...noSignals, duplicatePhoto: true })).toBe(FRAUD_SIGNAL_WEIGHTS.duplicatePhoto);
    expect(computeFraudScore({ ...noSignals, duplicateContent: true })).toBe(FRAUD_SIGNAL_WEIGHTS.duplicateContent);
    expect(computeFraudScore({ ...noSignals, lowPrice: true })).toBe(FRAUD_SIGNAL_WEIGHTS.lowPrice);
    expect(computeFraudScore({ ...noSignals, vehicleInconsistency: true })).toBe(FRAUD_SIGNAL_WEIGHTS.vehicleInconsistency);
    expect(computeFraudScore({ ...noSignals, sellerRejectionHistory: true })).toBe(FRAUD_SIGNAL_WEIGHTS.sellerRejectionHistory);
  });

  it("sums correctly when two signals fire", () => {
    const score = computeFraudScore({ ...noSignals, duplicatePhoto: true, duplicateContent: true });
    expect(score).toBe(FRAUD_SIGNAL_WEIGHTS.duplicatePhoto + FRAUD_SIGNAL_WEIGHTS.duplicateContent);
  });

  it("is capped at 100 even when the raw sum would exceed it", () => {
    const allSignals = {
      duplicatePhoto: true,
      duplicateContent: true,
      duplicateVin: true,
      lowPrice: true,
      vehicleInconsistency: true,
      sellerRejectionHistory: true,
    };
    expect(computeFraudScore(allSignals)).toBe(100);
  });

  it("reaches 60+ (high-risk threshold) with the two heaviest signals only", () => {
    const score = computeFraudScore({ ...noSignals, duplicatePhoto: true, duplicateContent: true });
    expect(score).toBeGreaterThanOrEqual(60);
  });
});
