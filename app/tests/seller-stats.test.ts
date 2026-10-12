import { describe, expect, it } from "vitest";
import { computePriceBadge } from "@/lib/price-badge";

describe("seller-stats price badge integration", () => {
  it("returns TRES_BONNE_AFFAIRE when price is well below mid", () => {
    const result = computePriceBadge(170_000, 200_000, 5);
    expect(result).not.toBeNull();
    expect(result!.badge).toBe("TRES_BONNE_AFFAIRE");
    expect(result!.deviationPct).toBe(-15);
  });

  it("returns BON_PRIX for moderate discount", () => {
    const result = computePriceBadge(190_000, 200_000, 5);
    expect(result).not.toBeNull();
    expect(result!.badge).toBe("BON_PRIX");
  });

  it("returns CORRECT for fair price", () => {
    const result = computePriceBadge(200_000, 200_000, 5);
    expect(result).not.toBeNull();
    expect(result!.badge).toBe("CORRECT");
    expect(result!.deviationPct).toBe(0);
  });

  it("returns ELEVE for overpriced listing", () => {
    const result = computePriceBadge(220_000, 200_000, 5);
    expect(result).not.toBeNull();
    expect(result!.badge).toBe("ELEVE");
  });

  it("returns TRES_ELEVE for heavily overpriced listing", () => {
    const result = computePriceBadge(250_000, 200_000, 5);
    expect(result).not.toBeNull();
    expect(result!.badge).toBe("TRES_ELEVE");
  });

  it("returns null when sample size is too small", () => {
    expect(computePriceBadge(200_000, 200_000, 2)).toBeNull();
  });

  it("returns null when estimate mid is zero", () => {
    expect(computePriceBadge(200_000, 0, 5)).toBeNull();
  });
});
