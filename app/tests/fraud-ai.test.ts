import { beforeEach, describe, expect, it, vi } from "vitest";

const callAnthropicMessages = vi.fn();
vi.mock("@/lib/anthropic-client", () => ({
  callAnthropicMessages: (...a: unknown[]) => callAnthropicMessages(...a),
}));

const updateListing = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { listing: { update: (...a: unknown[]) => updateListing(...a) } },
}));

import { analyzeListingForFraud, analyzeAndStoreListingFraud } from "@/lib/fraud-ai";

const LISTING = {
  title: "Renault Clio à vendre",
  description: "Vend vite, besoin d'argent urgent, prix à débattre",
  price: 800_000,
  condition: "OCCASION" as const,
  year: 2015,
  mileage: 180_000,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("analyzeListingForFraud", () => {
  it("retourne null si ANTHROPIC_API_KEY absent", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await analyzeListingForFraud(LISTING);
    expect(result).toBeNull();
    expect(callAnthropicMessages).not.toHaveBeenCalled();
  });

  it("retourne null si Claude répond la chaîne 'null'", async () => {
    callAnthropicMessages.mockResolvedValue("null");
    expect(await analyzeListingForFraud(LISTING)).toBeNull();
  });

  it("retourne null si callAnthropicMessages retourne null", async () => {
    callAnthropicMessages.mockResolvedValue(null);
    expect(await analyzeListingForFraud(LISTING)).toBeNull();
  });

  it("retourne la suspicion quand Claude détecte un signal", async () => {
    callAnthropicMessages.mockResolvedValue("Urgence suspecte : vend vite + besoin d'argent urgent");
    const result = await analyzeListingForFraud(LISTING);
    expect(result).toBe("Urgence suspecte : vend vite + besoin d'argent urgent");
  });

  it("tronque la réponse à 200 caractères", async () => {
    const longText = "Signal ".repeat(50); // 350 chars
    callAnthropicMessages.mockResolvedValue(longText);
    const result = await analyzeListingForFraud(LISTING);
    expect(result).toHaveLength(200);
  });

  it("retourne null si callAnthropicMessages lève une exception", async () => {
    callAnthropicMessages.mockRejectedValue(new Error("réseau indisponible"));
    expect(await analyzeListingForFraud(LISTING)).toBeNull();
  });
});

describe("analyzeAndStoreListingFraud", () => {
  it("stocke la suspicion et aiCheckedAt quand Claude détecte un signal", async () => {
    callAnthropicMessages.mockResolvedValue("Kilométrage incohérent avec état NEUF déclaré");
    updateListing.mockResolvedValue({});

    await analyzeAndStoreListingFraud("listing-1", LISTING);

    expect(updateListing).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "listing-1" },
        data: expect.objectContaining({
          aiSuspicion: "Kilométrage incohérent avec état NEUF déclaré",
          aiCheckedAt: expect.any(Date),
        }),
      })
    );
  });

  it("stocke null si aucune suspicion détectée", async () => {
    callAnthropicMessages.mockResolvedValue("null");
    updateListing.mockResolvedValue({});

    await analyzeAndStoreListingFraud("listing-2", LISTING);

    expect(updateListing).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ aiSuspicion: null }),
      })
    );
  });
});
