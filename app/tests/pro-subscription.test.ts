import { describe, expect, it } from "vitest";
import {
  hasAdvancedProTools,
  checkSubscriptionUpgradeEligible,
  effectiveTier,
  isWithinQuota,
  priceForAnyTier,
  priceForTier,
  quotaForTier,
  SUBSCRIPTION_QUOTAS,
  tierRank,
} from "@/lib/pro-subscription";

describe("tierRank", () => {
  it("ranks tiers by real value, never alphabetically", () => {
    expect(tierRank("STARTER")).toBeLessThan(tierRank("BUSINESS"));
    expect(tierRank("BUSINESS")).toBeLessThan(tierRank("PRO"));
    expect(tierRank("PRO")).toBeLessThan(tierRank("PREMIUM"));
  });
});

describe("isWithinQuota", () => {
  it("allows a new listing when under the tier quota", () => {
    expect(isWithinQuota(4, "STARTER")).toBe(true);
  });

  it("blocks a new listing once the tier quota is reached", () => {
    expect(isWithinQuota(SUBSCRIPTION_QUOTAS.STARTER!, "STARTER")).toBe(false);
  });

  it("never blocks PREMIUM (unlimited quota)", () => {
    expect(isWithinQuota(10_000, "PREMIUM")).toBe(true);
  });
});

describe("checkSubscriptionUpgradeEligible", () => {
  it("allows an upgrade to a strictly higher tier", () => {
    const result = checkSubscriptionUpgradeEligible({
      currentTier: "STARTER",
      targetTier: "PRO",
      hasPendingOrder: false,
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects a same-tier request as not an upgrade", () => {
    const result = checkSubscriptionUpgradeEligible({
      currentTier: "BUSINESS",
      targetTier: "BUSINESS",
      hasPendingOrder: false,
    });
    expect(result).toEqual({ ok: false, error: "not_an_upgrade" });
  });

  it("rejects a downgrade as not an upgrade", () => {
    const result = checkSubscriptionUpgradeEligible({
      currentTier: "PRO",
      targetTier: "BUSINESS",
      hasPendingOrder: false,
    });
    expect(result).toEqual({ ok: false, error: "not_an_upgrade" });
  });

  it("rejects when a payment order is already pending", () => {
    const result = checkSubscriptionUpgradeEligible({
      currentTier: "STARTER",
      targetTier: "PREMIUM",
      hasPendingOrder: true,
    });
    expect(result).toEqual({ ok: false, error: "order_pending" });
  });
});

describe("effectiveTier", () => {
  const now = new Date("2026-09-06T00:00:00Z");

  it("keeps STARTER as-is regardless of expiresAt", () => {
    expect(effectiveTier("STARTER", null, now)).toBe("STARTER");
  });

  it("keeps a paid tier active before expiry", () => {
    const future = new Date("2026-10-01T00:00:00Z");
    expect(effectiveTier("PRO", future, now)).toBe("PRO");
  });

  it("reverts an expired paid tier to STARTER", () => {
    const past = new Date("2026-08-01T00:00:00Z");
    expect(effectiveTier("PRO", past, now)).toBe("STARTER");
  });
});

describe("priceForTier", () => {
  it("returns a strictly positive price for every paid tier", () => {
    expect(priceForTier("BUSINESS")).toBeGreaterThan(0);
    expect(priceForTier("PRO")).toBeGreaterThan(0);
    expect(priceForTier("PREMIUM")).toBeGreaterThan(0);
  });

  it("prices increase with the tier", () => {
    expect(priceForTier("BUSINESS")).toBeLessThan(priceForTier("PRO"));
    expect(priceForTier("PRO")).toBeLessThan(priceForTier("PREMIUM"));
  });
});

describe("priceForAnyTier", () => {
  it("is free (null) for STARTER, unlike every paid tier", () => {
    expect(priceForAnyTier("STARTER")).toBeNull();
  });

  it("matches priceForTier for every paid tier", () => {
    expect(priceForAnyTier("BUSINESS")).toBe(priceForTier("BUSINESS"));
    expect(priceForAnyTier("PRO")).toBe(priceForTier("PRO"));
    expect(priceForAnyTier("PREMIUM")).toBe(priceForTier("PREMIUM"));
  });
});

describe("quotaForTier", () => {
  it("returns the documented quota for a limited tier", () => {
    expect(quotaForTier("STARTER")).toBe(SUBSCRIPTION_QUOTAS.STARTER);
  });

  it("returns null (unlimited) for PREMIUM", () => {
    expect(quotaForTier("PREMIUM")).toBeNull();
  });
});

describe("hasAdvancedProTools", () => {
  it("is disabled for STARTER and BUSINESS, never documented with this tool", () => {
    expect(hasAdvancedProTools("STARTER")).toBe(false);
    expect(hasAdvancedProTools("BUSINESS")).toBe(false);
  });

  it("is enabled for PRO and PREMIUM", () => {
    expect(hasAdvancedProTools("PRO")).toBe(true);
    expect(hasAdvancedProTools("PREMIUM")).toBe(true);
  });
});
