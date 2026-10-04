import { beforeEach, describe, expect, it, vi } from "vitest";

const callAnthropicMessages = vi.fn();
vi.mock("@/lib/anthropic-client", () => ({
  callAnthropicMessages: (...a: unknown[]) => callAnthropicMessages(...a),
}));

const brandFindUnique = vi.fn();
const modelFindUnique = vi.fn();
const listingUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: { findUnique: (...a: unknown[]) => brandFindUnique(...a) },
    model: { findUnique: (...a: unknown[]) => modelFindUnique(...a) },
    listing: { update: (...a: unknown[]) => listingUpdate(...a) },
  },
}));

const estimatePrice = vi.fn();
vi.mock("@/lib/price-estimation", () => ({
  estimatePrice: (...a: unknown[]) => estimatePrice(...a),
}));

import { estimatePriceWithAi, computeAndStorePriceAiEstimate } from "@/lib/price-ai";

const PARAMS = { brandId: 1, modelId: 10, year: 2019, mileage: 80_000, condition: "OCCASION", fuelType: "DIESEL" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
  brandFindUnique.mockResolvedValue({ name: "Renault" });
  modelFindUnique.mockResolvedValue({ name: "Clio" });
});

describe("estimatePriceWithAi", () => {
  it("retourne null si ANTHROPIC_API_KEY absent", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(await estimatePriceWithAi(PARAMS)).toBeNull();
    expect(callAnthropicMessages).not.toHaveBeenCalled();
  });

  it("retourne null si la marque n'existe pas en base", async () => {
    brandFindUnique.mockResolvedValue(null);
    expect(await estimatePriceWithAi(PARAMS)).toBeNull();
  });

  it("retourne null si le modèle n'existe pas en base", async () => {
    modelFindUnique.mockResolvedValue(null);
    expect(await estimatePriceWithAi(PARAMS)).toBeNull();
  });

  it("retourne null si callAnthropicMessages retourne null", async () => {
    callAnthropicMessages.mockResolvedValue(null);
    expect(await estimatePriceWithAi(PARAMS)).toBeNull();
  });

  it("retourne {low, high} sur une réponse JSON valide", async () => {
    callAnthropicMessages.mockResolvedValue('{"low":1800000,"high":2400000}');
    const result = await estimatePriceWithAi(PARAMS);
    expect(result).toEqual({ low: 1_800_000, high: 2_400_000 });
  });

  it("extrait le JSON même entouré de texte", async () => {
    callAnthropicMessages.mockResolvedValue('Voici la fourchette : {"low":2000000,"high":2500000} en DA.');
    const result = await estimatePriceWithAi(PARAMS);
    expect(result).toEqual({ low: 2_000_000, high: 2_500_000 });
  });

  it("retourne null si JSON malformé", async () => {
    callAnthropicMessages.mockResolvedValue("pas du JSON");
    expect(await estimatePriceWithAi(PARAMS)).toBeNull();
  });

  it("retourne null si low >= high", async () => {
    callAnthropicMessages.mockResolvedValue('{"low":3000000,"high":2000000}');
    expect(await estimatePriceWithAi(PARAMS)).toBeNull();
  });
});

describe("computeAndStorePriceAiEstimate", () => {
  it("ne fait rien si brandId est null", async () => {
    await computeAndStorePriceAiEstimate("listing-1", { ...PARAMS, brandId: null });
    expect(callAnthropicMessages).not.toHaveBeenCalled();
    expect(listingUpdate).not.toHaveBeenCalled();
  });

  it("ne fait rien si modelId est null", async () => {
    await computeAndStorePriceAiEstimate("listing-1", { ...PARAMS, modelId: null });
    expect(callAnthropicMessages).not.toHaveBeenCalled();
    expect(listingUpdate).not.toHaveBeenCalled();
  });

  it("ne fait rien si le marché a déjà >= 3 comparables", async () => {
    estimatePrice.mockResolvedValue({ sampleSize: 5, low: 1_800_000, mid: 2_000_000, high: 2_200_000 });
    await computeAndStorePriceAiEstimate("listing-1", PARAMS);
    expect(callAnthropicMessages).not.toHaveBeenCalled();
    expect(listingUpdate).not.toHaveBeenCalled();
  });

  it("stocke priceAiLow/High/At quand sampleSize < 3", async () => {
    estimatePrice.mockResolvedValue({ sampleSize: 1, low: 0, mid: 0, high: 0 });
    callAnthropicMessages.mockResolvedValue('{"low":1900000,"high":2300000}');
    listingUpdate.mockResolvedValue({});

    await computeAndStorePriceAiEstimate("listing-1", PARAMS);

    expect(listingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "listing-1" },
        data: expect.objectContaining({
          priceAiLow: 1_900_000,
          priceAiHigh: 2_300_000,
          priceAiAt: expect.any(Date),
        }),
      })
    );
  });

  it("ne stocke pas si estimatePriceWithAi retourne null", async () => {
    estimatePrice.mockResolvedValue(null);
    callAnthropicMessages.mockResolvedValue(null);
    await computeAndStorePriceAiEstimate("listing-1", PARAMS);
    expect(listingUpdate).not.toHaveBeenCalled();
  });
});
