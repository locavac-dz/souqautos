import { describe, expect, it } from "vitest";
import { estimateRcPremiumDzd, type RcEstimate } from "@/lib/insurance-estimate";

describe("estimateRcPremiumDzd", () => {
  it("returns a range for a low-power vehicle (≤ 5 CV)", () => {
    const result = estimateRcPremiumDzd(4);
    expect(result.lowDzd).toBeLessThan(result.highDzd);
    expect(result.lowDzd).toBe(8_000);
    expect(result.highDzd).toBe(12_000);
  });

  it("returns a range for 6 CV (second bracket)", () => {
    const result = estimateRcPremiumDzd(6);
    expect(result.lowDzd).toBe(11_000);
    expect(result.highDzd).toBe(15_000);
  });

  it("returns a range for 10 CV (third bracket)", () => {
    const result = estimateRcPremiumDzd(10);
    expect(result.lowDzd).toBe(14_000);
    expect(result.highDzd).toBe(19_000);
  });

  it("returns a range for 12 CV (fourth bracket)", () => {
    const result = estimateRcPremiumDzd(12);
    expect(result.lowDzd).toBe(18_000);
    expect(result.highDzd).toBe(23_000);
  });

  it("returns the top bracket for high-power vehicles (≥ 15 CV)", () => {
    const result = estimateRcPremiumDzd(15);
    expect(result.lowDzd).toBe(22_000);
    expect(result.highDzd).toBe(28_000);
  });

  it("uses the top bracket for very high power (30 CV)", () => {
    const result = estimateRcPremiumDzd(30);
    expect(result.lowDzd).toBe(22_000);
    expect(result.highDzd).toBe(28_000);
  });

  it("returns a range for 1 CV (minimum)", () => {
    const result = estimateRcPremiumDzd(1);
    expect(result.lowDzd).toBe(8_000);
  });

  it("boundary: 5 CV is in the first bracket, 6 CV in the second", () => {
    const at5 = estimateRcPremiumDzd(5);
    const at6 = estimateRcPremiumDzd(6);
    expect(at5.lowDzd).toBeLessThan(at6.lowDzd);
  });

  it("always returns lowDzd < highDzd", () => {
    for (let cv = 1; cv <= 20; cv++) {
      const r = estimateRcPremiumDzd(cv);
      expect(r.lowDzd).toBeLessThan(r.highDzd);
    }
  });
});
