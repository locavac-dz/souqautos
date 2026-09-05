import { describe, expect, it } from "vitest";
import {
  checkFormulaUpgradeEligible,
  formulaRank,
  formulaValidityDays,
  priceForFormula,
  PREMIUM_VALIDITY_DAYS,
  PREMIUM_PLUS_VALIDITY_DAYS,
} from "@/lib/payment-orders";

describe("formulaRank", () => {
  it("orders STANDARD < PREMIUM < PREMIUM_PLUS explicitly (never via alphabetical enum sort)", () => {
    expect(formulaRank("STANDARD")).toBeLessThan(formulaRank("PREMIUM"));
    expect(formulaRank("PREMIUM")).toBeLessThan(formulaRank("PREMIUM_PLUS"));
  });
});

describe("formulaValidityDays", () => {
  it("gives PREMIUM_PLUS a longer duration than PREMIUM, and PREMIUM longer than STANDARD", () => {
    expect(formulaValidityDays("PREMIUM_PLUS")).toBeGreaterThan(formulaValidityDays("PREMIUM"));
    expect(formulaValidityDays("PREMIUM")).toBeGreaterThan(formulaValidityDays("STANDARD"));
  });

  it("matches the documented constants", () => {
    expect(formulaValidityDays("PREMIUM")).toBe(PREMIUM_VALIDITY_DAYS);
    expect(formulaValidityDays("PREMIUM_PLUS")).toBe(PREMIUM_PLUS_VALIDITY_DAYS);
  });
});

describe("checkFormulaUpgradeEligible", () => {
  const base = {
    status: "PUBLIEE" as const,
    currentFormula: "STANDARD" as const,
    targetFormula: "PREMIUM" as const,
    hasPendingOrder: false,
  };

  it("accepts an upgrade from STANDARD to PREMIUM on a published listing", () => {
    expect(checkFormulaUpgradeEligible(base)).toEqual({ ok: true });
  });

  it("accepts an upgrade on an expired listing (renewal-eligible)", () => {
    expect(checkFormulaUpgradeEligible({ ...base, status: "EXPIREE" })).toEqual({ ok: true });
  });

  it("rejects a listing pending moderation (never bypass moderation via payment)", () => {
    expect(checkFormulaUpgradeEligible({ ...base, status: "EN_ATTENTE" })).toEqual({
      ok: false,
      error: "invalid_status",
    });
  });

  it("rejects a suspended listing", () => {
    expect(checkFormulaUpgradeEligible({ ...base, status: "SUSPENDUE" })).toEqual({
      ok: false,
      error: "invalid_status",
    });
  });

  it("rejects a same-tier or downgrade request", () => {
    expect(
      checkFormulaUpgradeEligible({ ...base, currentFormula: "PREMIUM", targetFormula: "PREMIUM" })
    ).toEqual({ ok: false, error: "not_an_upgrade" });
    expect(
      checkFormulaUpgradeEligible({ ...base, currentFormula: "PREMIUM_PLUS", targetFormula: "PREMIUM" })
    ).toEqual({ ok: false, error: "not_an_upgrade" });
  });

  it("rejects a second request while one is already pending", () => {
    expect(checkFormulaUpgradeEligible({ ...base, hasPendingOrder: true })).toEqual({
      ok: false,
      error: "order_pending",
    });
  });
});

describe("priceForFormula", () => {
  const settings = { premiumPriceDzd: 1500, premiumPlusPriceDzd: 3000 };

  it("returns the matching price for each formula", () => {
    expect(priceForFormula("PREMIUM", settings)).toBe(1500);
    expect(priceForFormula("PREMIUM_PLUS", settings)).toBe(3000);
  });
});
