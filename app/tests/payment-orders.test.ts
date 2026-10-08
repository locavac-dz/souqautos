import { describe, expect, it } from "vitest";
import {
  checkFormulaUpgradeEligible,
  computePaymentOrderStats,
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

describe("computePaymentOrderStats", () => {
  it("returns a null confirmation rate when no order has been decided yet (never a fabricated 0%)", () => {
    const stats = computePaymentOrderStats([
      { status: "EN_ATTENTE", formula: "PREMIUM", amountDzd: 1500 },
    ]);
    expect(stats.confirmationRate).toBeNull();
    expect(stats.pendingCount).toBe(1);
    expect(stats.totalRevenueDzd).toBe(0);
  });

  it("counts only confirmed orders toward revenue, never pending or rejected", () => {
    const stats = computePaymentOrderStats([
      { status: "CONFIRMEE", formula: "PREMIUM", amountDzd: 1500 },
      { status: "REJETEE", formula: "PREMIUM_PLUS", amountDzd: 3000 },
      { status: "EN_ATTENTE", formula: "PREMIUM_PLUS", amountDzd: 3000 },
    ]);
    expect(stats.totalRevenueDzd).toBe(1500);
    expect(stats.confirmedCount).toBe(1);
    expect(stats.rejectedCount).toBe(1);
    expect(stats.pendingCount).toBe(1);
  });

  it("computes the confirmation rate over decided orders only (excludes pending from the denominator)", () => {
    const stats = computePaymentOrderStats([
      { status: "CONFIRMEE", formula: "PREMIUM", amountDzd: 1500 },
      { status: "CONFIRMEE", formula: "PREMIUM", amountDzd: 1500 },
      { status: "REJETEE", formula: "PREMIUM", amountDzd: 1500 },
      { status: "EN_ATTENTE", formula: "PREMIUM", amountDzd: 1500 },
    ]);
    expect(stats.confirmationRate).toBeCloseTo(2 / 3);
  });

  it("splits revenue by formula", () => {
    const stats = computePaymentOrderStats([
      { status: "CONFIRMEE", formula: "PREMIUM", amountDzd: 1500 },
      { status: "CONFIRMEE", formula: "PREMIUM_PLUS", amountDzd: 3000 },
      { status: "CONFIRMEE", formula: "PREMIUM_PLUS", amountDzd: 3000 },
    ]);
    expect(stats.premiumRevenueDzd).toBe(1500);
    expect(stats.premiumPlusRevenueDzd).toBe(6000);
    expect(stats.totalRevenueDzd).toBe(7500);
  });

  it("counts a canceled online payment apart, outside the confirmation rate (Lot 264)", () => {
    const stats = computePaymentOrderStats([
      { status: "CONFIRMEE", formula: "PREMIUM", amountDzd: 1500 },
      { status: "ANNULEE", formula: "PREMIUM", amountDzd: 1500 },
      { status: "ANNULEE", formula: "PREMIUM_PLUS", amountDzd: 3000 },
    ]);
    expect(stats.canceledCount).toBe(2);
    expect(stats.confirmedCount).toBe(1);
    expect(stats.rejectedCount).toBe(0);
    expect(stats.confirmationRate).toBe(1);
    expect(stats.totalRevenueDzd).toBe(1500);
  });

  it("returns all zeros/null on an empty list", () => {
    const stats = computePaymentOrderStats([]);
    expect(stats).toEqual({
      confirmedCount: 0,
      rejectedCount: 0,
      pendingCount: 0,
      canceledCount: 0,
      confirmationRate: null,
      totalRevenueDzd: 0,
      premiumRevenueDzd: 0,
      premiumPlusRevenueDzd: 0,
    });
  });
});
