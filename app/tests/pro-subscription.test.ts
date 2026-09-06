import { describe, expect, it } from "vitest";
import {
  hasAdvancedProTools,
  checkSubscriptionUpgradeEligible,
  effectiveTier,
  isWithinQuota,
  priceForAnyTier,
  priceForTier,
  quotaForTier,
  tierRank,
} from "@/lib/pro-subscription";
import type { ProSubscriptionSettingsValues } from "@/lib/pro-subscription-settings";

const settings: ProSubscriptionSettingsValues = {
  starterQuota: 5,
  businessQuota: 20,
  proQuota: 60,
  businessPriceDzd: 3000,
  proPriceDzd: 6000,
  premiumPriceDzd: 12000,
};

describe("tierRank", () => {
  it("ranks tiers by real value, never alphabetically", () => {
    expect(tierRank("STARTER")).toBeLessThan(tierRank("BUSINESS"));
    expect(tierRank("BUSINESS")).toBeLessThan(tierRank("PRO"));
    expect(tierRank("PRO")).toBeLessThan(tierRank("PREMIUM"));
  });
});

describe("isWithinQuota", () => {
  it("allows a new listing when under the resolved quota", () => {
    expect(isWithinQuota(4, 5)).toBe(true);
  });

  it("blocks a new listing once the resolved quota is reached", () => {
    expect(isWithinQuota(5, 5)).toBe(false);
  });

  it("never blocks an unlimited (null) quota", () => {
    expect(isWithinQuota(10_000, null)).toBe(true);
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
  it("reads the configured price for every paid tier", () => {
    expect(priceForTier("BUSINESS", settings)).toBe(settings.businessPriceDzd);
    expect(priceForTier("PRO", settings)).toBe(settings.proPriceDzd);
    expect(priceForTier("PREMIUM", settings)).toBe(settings.premiumPriceDzd);
  });

  it("reflects a settings change immediately, never a stale hardcoded value", () => {
    const custom = { ...settings, proPriceDzd: 9999 };
    expect(priceForTier("PRO", custom)).toBe(9999);
  });
});

describe("priceForAnyTier", () => {
  it("is free (null) for STARTER, unlike every paid tier", () => {
    expect(priceForAnyTier("STARTER", settings)).toBeNull();
  });

  it("matches priceForTier for every paid tier", () => {
    expect(priceForAnyTier("BUSINESS", settings)).toBe(priceForTier("BUSINESS", settings));
    expect(priceForAnyTier("PRO", settings)).toBe(priceForTier("PRO", settings));
    expect(priceForAnyTier("PREMIUM", settings)).toBe(priceForTier("PREMIUM", settings));
  });
});

describe("quotaForTier", () => {
  it("returns the configured quota for a limited tier", () => {
    expect(quotaForTier("STARTER", settings)).toBe(settings.starterQuota);
    expect(quotaForTier("BUSINESS", settings)).toBe(settings.businessQuota);
    expect(quotaForTier("PRO", settings)).toBe(settings.proQuota);
  });

  it("returns null (unlimited) for PREMIUM regardless of settings", () => {
    expect(quotaForTier("PREMIUM", settings)).toBeNull();
  });

  it("reflects a settings change immediately, never a stale hardcoded value", () => {
    const custom = { ...settings, starterQuota: 1 };
    expect(quotaForTier("STARTER", custom)).toBe(1);
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
