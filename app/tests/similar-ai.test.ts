import { beforeEach, describe, expect, it, vi } from "vitest";

const callAnthropicMessages = vi.fn();
vi.mock("@/lib/anthropic-client", () => ({
  callAnthropicMessages: (...a: unknown[]) => callAnthropicMessages(...a),
}));

// cachedReference appelle directement la factory — pas de cache dans les tests.
vi.mock("@/lib/reference-data", () => ({
  cachedReference: (_key: string, factory: () => unknown) => factory(),
}));

const brandFindUnique = vi.fn();
const modelFindUnique = vi.fn();
const brandFindFirst = vi.fn();
const modelFindFirst = vi.fn();
const listingFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: {
      findUnique: (...a: unknown[]) => brandFindUnique(...a),
      findFirst: (...a: unknown[]) => brandFindFirst(...a),
    },
    model: {
      findUnique: (...a: unknown[]) => modelFindUnique(...a),
      findFirst: (...a: unknown[]) => modelFindFirst(...a),
    },
    listing: { findMany: (...a: unknown[]) => listingFindMany(...a) },
  },
}));

// listingCardInclude utilisé tel quel — pas d'import côté test.
vi.mock("@/lib/search", () => ({ listingCardInclude: {} }));

import { getAlternativeListings } from "@/lib/similar-ai";

const BASE_ARGS = { excludeId: "listing-0", brandId: 1, modelId: 10, price: 2_000_000 };

function makeListing(id: string) {
  return { id, price: 2_000_000, status: "PUBLIEE" };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
  brandFindUnique.mockResolvedValue({ name: "Renault" });
  modelFindUnique.mockResolvedValue({ name: "Clio" });
  brandFindFirst.mockResolvedValue({ id: 2 });
  modelFindFirst.mockResolvedValue({ id: 20 });
  listingFindMany.mockResolvedValue([makeListing("alt-1"), makeListing("alt-2")]);
  callAnthropicMessages.mockResolvedValue('[{"brand":"Peugeot","model":"208"}]');
});

describe("getAlternativeListings", () => {
  it("retourne [] si brandId est null", async () => {
    expect(await getAlternativeListings({ ...BASE_ARGS, brandId: null })).toEqual([]);
  });

  it("retourne [] si modelId est null", async () => {
    expect(await getAlternativeListings({ ...BASE_ARGS, modelId: null })).toEqual([]);
  });

  it("retourne [] si ANTHROPIC_API_KEY absent", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(await getAlternativeListings(BASE_ARGS)).toEqual([]);
  });

  it("retourne [] si la marque n'est pas trouvée en base", async () => {
    brandFindUnique.mockResolvedValue(null);
    expect(await getAlternativeListings(BASE_ARGS)).toEqual([]);
  });

  it("retourne [] si le modèle n'est pas trouvé en base", async () => {
    modelFindUnique.mockResolvedValue(null);
    expect(await getAlternativeListings(BASE_ARGS)).toEqual([]);
  });

  it("retourne [] si Claude ne retourne pas de JSON valide", async () => {
    callAnthropicMessages.mockResolvedValue("aucune correspondance");
    expect(await getAlternativeListings(BASE_ARGS)).toEqual([]);
  });

  it("retourne [] si la marque alternative n'est pas en base", async () => {
    brandFindFirst.mockResolvedValue(null);
    expect(await getAlternativeListings(BASE_ARGS)).toEqual([]);
  });

  it("retourne les annonces alternatives trouvées", async () => {
    const result = await getAlternativeListings(BASE_ARGS);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("alt-1");
  });

  it("exclut l'annonce courante (excludeId)", async () => {
    listingFindMany.mockResolvedValue([makeListing("listing-0"), makeListing("alt-1")]);
    const result = await getAlternativeListings(BASE_ARGS);
    expect(result.map((l) => l.id)).not.toContain("listing-0");
  });

  it("plafonne à 6 annonces (MAX_TOTAL) sur plusieurs modèles", async () => {
    // Claude retourne 4 modèles concurrents, chacun fournit 2 annonces → 8 au total
    callAnthropicMessages.mockResolvedValue(
      '[{"brand":"Peugeot","model":"208"},{"brand":"Hyundai","model":"i20"},{"brand":"Kia","model":"Rio"},{"brand":"Toyota","model":"Yaris"}]'
    );
    listingFindMany.mockImplementation(() =>
      Promise.resolve([makeListing(`a-${Math.random()}`), makeListing(`b-${Math.random()}`)])
    );
    const result = await getAlternativeListings(BASE_ARGS);
    expect(result.length).toBeLessThanOrEqual(6);
  });

  it("déduplique les annonces si elles apparaissent dans plusieurs modèles", async () => {
    callAnthropicMessages.mockResolvedValue(
      '[{"brand":"Peugeot","model":"208"},{"brand":"Peugeot","model":"208"}]'
    );
    listingFindMany.mockResolvedValue([makeListing("dup-1"), makeListing("dup-2")]);
    const result = await getAlternativeListings(BASE_ARGS);
    const ids = result.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
