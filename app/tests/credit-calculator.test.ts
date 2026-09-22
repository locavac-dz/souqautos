import { describe, expect, it } from "vitest";
import { computeCredit } from "@/lib/credit-calculator";

describe("computeCredit — formule d'annuité constante", () => {
  it("cas de base : 1 000 000 DA sur 60 mois à 9,5 %", () => {
    const r = computeCredit({ price: 1_000_000, downPayment: 0, annualRatePct: 9.5, durationMonths: 60 });
    expect(r).not.toBeNull();
    // mensualité théorique ≈ 20 926 DA
    expect(r!.monthly).toBeGreaterThan(20_000);
    expect(r!.monthly).toBeLessThan(22_000);
    expect(r!.total).toBeGreaterThan(r!.principal);
    expect(r!.interest).toBe(r!.total - 1_000_000);
  });

  it("apport partiel réduit le principal et les intérêts", () => {
    const sans = computeCredit({ price: 2_000_000, downPayment: 0, annualRatePct: 9, durationMonths: 60 });
    const avec = computeCredit({ price: 2_000_000, downPayment: 500_000, annualRatePct: 9, durationMonths: 60 });
    expect(avec!.principal).toBe(1_500_000);
    expect(avec!.monthly).toBeLessThan(sans!.monthly);
    expect(avec!.interest).toBeLessThan(sans!.interest);
  });

  it("taux zéro : mensualité = principal / durée (sans intérêts)", () => {
    const r = computeCredit({ price: 1_200_000, downPayment: 0, annualRatePct: 0, durationMonths: 12 });
    expect(r!.monthly).toBe(100_000);
    expect(r!.interest).toBe(0);
  });

  it("durée plus longue → mensualité plus basse mais total plus élevé", () => {
    const court = computeCredit({ price: 1_000_000, downPayment: 0, annualRatePct: 9, durationMonths: 24 });
    const long_ = computeCredit({ price: 1_000_000, downPayment: 0, annualRatePct: 9, durationMonths: 84 });
    expect(long_!.monthly).toBeLessThan(court!.monthly);
    expect(long_!.total).toBeGreaterThan(court!.total);
  });

  it("apport égal au prix → null (aucun crédit nécessaire)", () => {
    expect(computeCredit({ price: 1_000_000, downPayment: 1_000_000, annualRatePct: 9, durationMonths: 60 })).toBeNull();
  });

  it("apport supérieur au prix → null", () => {
    expect(computeCredit({ price: 500_000, downPayment: 800_000, annualRatePct: 9, durationMonths: 60 })).toBeNull();
  });

  it("prix nul → null", () => {
    expect(computeCredit({ price: 0, downPayment: 0, annualRatePct: 9, durationMonths: 60 })).toBeNull();
  });

  it("durée nulle → null", () => {
    expect(computeCredit({ price: 1_000_000, downPayment: 0, annualRatePct: 9, durationMonths: 0 })).toBeNull();
  });

  it("taux négatif → null", () => {
    expect(computeCredit({ price: 1_000_000, downPayment: 0, annualRatePct: -1, durationMonths: 60 })).toBeNull();
  });

  it("total ≈ mensualité × durée + apport (±1 DA d'arrondi)", () => {
    const r = computeCredit({ price: 3_000_000, downPayment: 600_000, annualRatePct: 8, durationMonths: 48 });
    expect(Math.abs(r!.total - (r!.monthly * 48 + 600_000))).toBeLessThanOrEqual(1);
  });

  it("intérêts = total − prix", () => {
    const r = computeCredit({ price: 2_000_000, downPayment: 200_000, annualRatePct: 10, durationMonths: 72 });
    expect(r!.interest).toBe(r!.total - 2_000_000);
  });

  it("taux élevé (20 %) → mensualité et intérêts nettement plus élevés qu'à 5 %", () => {
    const bas = computeCredit({ price: 1_000_000, downPayment: 0, annualRatePct: 5, durationMonths: 60 });
    const haut = computeCredit({ price: 1_000_000, downPayment: 0, annualRatePct: 20, durationMonths: 60 });
    expect(haut!.monthly).toBeGreaterThan(bas!.monthly * 1.3);
    expect(haut!.interest).toBeGreaterThan(bas!.interest * 2);
  });
});
