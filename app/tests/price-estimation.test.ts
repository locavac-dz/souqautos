import { describe, expect, it } from "vitest";
import { computeEstimateFromPrices, estimateFromRows } from "@/lib/price-estimation";
import { computePriceBadge } from "@/lib/price-badge";

describe("computeEstimateFromPrices", () => {
  it("returns null for an empty sample", () => {
    expect(computeEstimateFromPrices([])).toBeNull();
  });

  it("returns the single price as low/mid/high for a sample of one", () => {
    const result = computeEstimateFromPrices([2_800_000]);
    expect(result).toMatchObject({ low: 2_800_000, mid: 2_800_000, high: 2_800_000, sampleSize: 1 });
    expect(result!.confidenceLabel).toBe("faible");
  });

  it("computes low/high as the min/max and mid as the median (odd count)", () => {
    const result = computeEstimateFromPrices([3_000_000, 2_000_000, 2_500_000]);
    expect(result).toMatchObject({ low: 2_000_000, mid: 2_500_000, high: 3_000_000, sampleSize: 3 });
  });

  it("computes the median as the average of the two middle values (even count)", () => {
    const result = computeEstimateFromPrices([1_000_000, 2_000_000, 3_000_000, 4_000_000]);
    expect(result!.mid).toBe(2_500_000);
  });

  it("is not affected by input order", () => {
    const a = computeEstimateFromPrices([5, 1, 3, 2, 4]);
    const b = computeEstimateFromPrices([1, 2, 3, 4, 5]);
    expect(a).toEqual(b);
  });

  it("raises the confidence level as the sample size grows", () => {
    const small = computeEstimateFromPrices([1, 2])!;
    const medium = computeEstimateFromPrices([1, 2, 3, 4])!;
    const large = computeEstimateFromPrices(Array.from({ length: 20 }, (_, i) => i + 1))!;
    expect(small.confidenceLabel).toBe("faible");
    expect(medium.confidenceLabel).toBe("moyenne");
    expect(large.confidenceLabel).toBe("elevee");
    expect(small.confidencePct).toBeLessThan(medium.confidencePct);
    expect(medium.confidencePct).toBeLessThan(large.confidencePct);
  });

  it("never reports full certainty regardless of sample size", () => {
    const huge = computeEstimateFromPrices(Array.from({ length: 500 }, (_, i) => i + 1))!;
    expect(huge.confidencePct).toBeLessThan(100);
  });
});

describe("estimateFromRows", () => {
  const rows = [
    { id: "a", price: 2_000_000, year: 2019, mileage: 80_000, wilayaId: 16 },
    { id: "b", price: 2_200_000, year: 2019, mileage: 85_000, wilayaId: 16 },
    { id: "c", price: 2_100_000, year: 2017, mileage: 120_000, wilayaId: 31 },
    { id: "self", price: 2_800_000, year: 2019, mileage: 85_000, wilayaId: 16 },
  ];

  it("returns null when there are no comparable rows at all", () => {
    expect(estimateFromRows([], { year: 2019, mileage: 85_000, wilayaId: 16 })).toBeNull();
  });

  it("excludes the listing's own row from its comparables", () => {
    const result = estimateFromRows(rows, {
      year: 2019,
      mileage: 85_000,
      wilayaId: 16,
      excludeListingId: "self",
    });
    // sans l'exclusion, "self" (2.8M) tirerait le résultat vers le haut
    expect(result!.high).toBeLessThan(2_800_000);
  });

  it("prefers the narrowest tier (year+mileage+wilaya) when it has matches", () => {
    const result = estimateFromRows(rows, {
      year: 2019,
      mileage: 82_000,
      wilayaId: 16,
      excludeListingId: "self",
    });
    expect(result!.appliedFilters).toEqual({ year: true, mileage: true, wilaya: true });
    expect(result!.sampleSize).toBe(2); // a et b seulement
  });

  it("falls back to a broader tier when the narrow one has no match", () => {
    // wilaya 99 n'existe dans aucune ligne : le palier le plus étroit échoue,
    // on retombe sur year+mileage sans wilaya.
    const result = estimateFromRows(rows, {
      year: 2019,
      mileage: 82_000,
      wilayaId: 99,
      excludeListingId: "self",
    });
    expect(result!.appliedFilters).toEqual({ year: true, mileage: true, wilaya: false });
  });

  it("falls back all the way to no filters when nothing else matches", () => {
    const result = estimateFromRows(rows, {
      year: 2005,
      mileage: 300_000,
      wilayaId: 99,
      excludeListingId: "self",
    });
    expect(result!.appliedFilters).toEqual({ year: false, mileage: false, wilaya: false });
    expect(result!.sampleSize).toBe(3); // a, b, c ("self" exclu explicitement)
  });

  it("ignores criteria the caller didn't provide", () => {
    const result = estimateFromRows(rows, {});
    expect(result!.appliedFilters).toEqual({ year: false, mileage: false, wilaya: false });
    expect(result!.sampleSize).toBe(4);
  });
});

describe("computePriceBadge", () => {
  it("returns null when the sample is too small to be meaningful", () => {
    expect(computePriceBadge(1_000_000, 1_000_000, 2)).toBeNull();
  });

  it("returns null for a non-positive market estimate", () => {
    expect(computePriceBadge(1_000_000, 0, 10)).toBeNull();
  });

  it("classifies a price well below the market estimate as a great deal", () => {
    const result = computePriceBadge(800_000, 1_000_000, 5); // -20%
    expect(result?.badge).toBe("TRES_BONNE_AFFAIRE");
    expect(result?.deviationPct).toBe(-20);
  });

  it("classifies a price moderately below the estimate as a good price", () => {
    const result = computePriceBadge(900_000, 1_000_000, 5); // -10%
    expect(result?.badge).toBe("BON_PRIX");
  });

  it("classifies a price close to the estimate as correct", () => {
    const result = computePriceBadge(1_020_000, 1_000_000, 5); // +2%
    expect(result?.badge).toBe("CORRECT");
  });

  it("classifies a price moderately above the estimate as high", () => {
    const result = computePriceBadge(1_150_000, 1_000_000, 5); // +15%
    expect(result?.badge).toBe("ELEVE");
  });

  it("classifies a price well above the estimate as very high", () => {
    const result = computePriceBadge(1_500_000, 1_000_000, 5); // +50%
    expect(result?.badge).toBe("TRES_ELEVE");
  });

  it("treats the boundary values consistently with the documented thresholds", () => {
    expect(computePriceBadge(850_000, 1_000_000, 5)?.badge).toBe("TRES_BONNE_AFFAIRE"); // exactly -15%
    expect(computePriceBadge(950_000, 1_000_000, 5)?.badge).toBe("BON_PRIX"); // exactly -5%
    expect(computePriceBadge(1_050_000, 1_000_000, 5)?.badge).toBe("CORRECT"); // exactly +5%
    expect(computePriceBadge(1_200_000, 1_000_000, 5)?.badge).toBe("ELEVE"); // exactly +20%
  });
});
