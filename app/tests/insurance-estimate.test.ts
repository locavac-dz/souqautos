import { describe, expect, it } from "vitest";
import { estimateRcPremiumDzd, estimateAllFormulas, FORMULA_KEYS, type RcEstimate } from "@/lib/insurance-estimate";

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

describe("estimateAllFormulas", () => {
  it("returns exactly 3 formulas", () => {
    const results = estimateAllFormulas(7);
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.formula)).toEqual(["rc", "rc_tiers", "tous_risques"]);
  });

  it("RC formula matches the base RC estimate", () => {
    const rc = estimateRcPremiumDzd(7);
    const formulas = estimateAllFormulas(7);
    const rcFormula = formulas[0];
    expect(rcFormula.lowDzd).toBe(Math.round(rc.lowDzd / 100) * 100);
    expect(rcFormula.highDzd).toBe(Math.round(rc.highDzd / 100) * 100);
  });

  it("RC + tiers is more expensive than RC alone", () => {
    const formulas = estimateAllFormulas(7);
    expect(formulas[1].lowDzd).toBeGreaterThan(formulas[0].lowDzd);
    expect(formulas[1].highDzd).toBeGreaterThan(formulas[0].highDzd);
  });

  it("tous risques is more expensive than RC + tiers", () => {
    const formulas = estimateAllFormulas(7);
    expect(formulas[2].lowDzd).toBeGreaterThan(formulas[1].lowDzd);
    expect(formulas[2].highDzd).toBeGreaterThan(formulas[1].highDzd);
  });

  it("each formula has covers and lowDzd < highDzd", () => {
    const formulas = estimateAllFormulas(10);
    for (const f of formulas) {
      expect(f.covers.length).toBeGreaterThan(0);
      expect(f.lowDzd).toBeLessThanOrEqual(f.highDzd);
    }
  });

  it("tous risques has more covers than RC", () => {
    const formulas = estimateAllFormulas(7);
    expect(formulas[2].covers.length).toBeGreaterThan(formulas[0].covers.length);
  });

  it("FORMULA_KEYS exports the 3 formulas", () => {
    expect(FORMULA_KEYS).toEqual(["rc", "rc_tiers", "tous_risques"]);
  });
});
