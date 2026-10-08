import { beforeEach, describe, expect, it, vi } from "vitest";

// Lot 267 (audit B6) — la seule action serveur du projet suit désormais le modèle des routes API : session,
// limite de débit, entrée validée. Refus = `null`, comme une estimation indisponible.
const getCurrentUser = vi.fn();
const checkRateLimit = vi.fn();
const estimatePrice = vi.fn();
const estimatePriceWithAi = vi.fn();

vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/price-estimation", () => ({ estimatePrice: (...a: unknown[]) => estimatePrice(...a) }));
vi.mock("@/lib/price-ai", () => ({ estimatePriceWithAi: (...a: unknown[]) => estimatePriceWithAi(...a) }));

import { getPriceEstimate, PRICE_ESTIMATE_RATE_LIMIT } from "@/lib/price-estimate-action";

const INPUT = { brandId: 1, modelId: 2, year: 2019, mileage: 80_000 };
const MARKET = { low: 1_000_000, mid: 1_200_000, high: 1_400_000, sampleSize: 12, confidencePct: 80, confidenceLabel: "bonne", appliedFilters: { year: true, mileage: true, wilaya: false, equipment: false } };

beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue({ id: "u1" });
  checkRateLimit.mockReset().mockResolvedValue(true);
  estimatePrice.mockReset().mockResolvedValue(MARKET);
  estimatePriceWithAi.mockReset().mockResolvedValue(null);
});

describe("getPriceEstimate", () => {
  it("answers from the market when there are enough comparables, for a signed-in user within the limit", async () => {
    expect(await getPriceEstimate(INPUT)).toEqual({ ...MARKET, source: "market" });
    expect(checkRateLimit).toHaveBeenCalledWith("price-estimate:u1", PRICE_ESTIMATE_RATE_LIMIT);
    expect(estimatePriceWithAi).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller without touching the database or the AI", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await getPriceEstimate(INPUT)).toBeNull();
    expect(estimatePrice).not.toHaveBeenCalled();
    expect(estimatePriceWithAi).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("refuses beyond the per-user limit (no paid AI call)", async () => {
    checkRateLimit.mockResolvedValue(false);
    estimatePrice.mockResolvedValue({ ...MARKET, sampleSize: 0 });
    expect(await getPriceEstimate(INPUT)).toBeNull();
    expect(estimatePrice).not.toHaveBeenCalled();
    expect(estimatePriceWithAi).not.toHaveBeenCalled();
  });

  it("refuses malformed input (ids, bounds, oversized equipment list) before any work", async () => {
    expect(await getPriceEstimate({ brandId: 0, modelId: 2 })).toBeNull();
    expect(await getPriceEstimate({ brandId: 1, modelId: 2, year: 1800 })).toBeNull();
    expect(await getPriceEstimate({ brandId: 1, modelId: 2, mileage: -5 })).toBeNull();
    expect(await getPriceEstimate({ brandId: 1, modelId: 2, equipmentIds: Array.from({ length: 61 }, (_, i) => i + 1) })).toBeNull();
    expect(await getPriceEstimate({ brandId: "1" as unknown as number, modelId: 2 })).toBeNull();
    expect(estimatePrice).not.toHaveBeenCalled();
  });

  it("falls back to the AI with the validated fields when comparables are scarce", async () => {
    estimatePrice.mockResolvedValue({ ...MARKET, sampleSize: 1 });
    estimatePriceWithAi.mockResolvedValue({ low: 900_000, high: 1_100_000 });
    const result = await getPriceEstimate({ ...INPUT, condition: "OCCASION", fuelType: "DIESEL" });
    expect(result).toMatchObject({ source: "ai", low: 900_000, mid: 1_000_000, high: 1_100_000, sampleSize: 0 });
    expect(estimatePriceWithAi).toHaveBeenCalledWith({ brandId: 1, modelId: 2, year: 2019, mileage: 80_000, condition: "OCCASION", fuelType: "DIESEL" });
  });

  it("returns the weak market estimate rather than nothing when the AI is unavailable", async () => {
    estimatePrice.mockResolvedValue({ ...MARKET, sampleSize: 1 });
    estimatePriceWithAi.mockRejectedValue(new Error("down"));
    expect(await getPriceEstimate(INPUT)).toEqual({ ...MARKET, sampleSize: 1, source: "market" });
  });
});
