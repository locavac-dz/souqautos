import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sanitizeParsedFilters, parseNaturalLanguageQuery } from "@/lib/ai-search";

const catalog = {
  brands: [
    { id: 3, name: "Renault", models: [{ id: 10, name: "Clio" }, { id: 11, name: "Megane" }] },
    { id: 5, name: "Peugeot", models: [{ id: 20, name: "208" }] },
  ],
  wilayas: [
    { id: 16, nomFr: "Alger" },
    { id: 31, nomFr: "Oran" },
  ],
};

describe("sanitizeParsedFilters", () => {
  it("accepts ids that exist in the provided catalog", () => {
    expect(sanitizeParsedFilters({ brandId: 3, modelId: 10, wilayaId: 16 }, catalog)).toEqual({
      brandId: "3",
      modelId: "10",
      wilayaId: "16",
    });
  });

  it("drops a brandId that does not exist in the catalog (never trusts a hallucinated id)", () => {
    expect(sanitizeParsedFilters({ brandId: 999 }, catalog)).toEqual({});
  });

  it("drops a modelId that does not belong to any known brand", () => {
    expect(sanitizeParsedFilters({ modelId: 12345 }, catalog)).toEqual({});
  });

  it("drops a wilayaId outside the catalog", () => {
    expect(sanitizeParsedFilters({ wilayaId: 999 }, catalog)).toEqual({});
  });

  it("accepts only known enum values", () => {
    expect(sanitizeParsedFilters({ fuelType: "DIESEL", condition: "BOGUS" }, catalog)).toEqual({
      fuelType: "DIESEL",
    });
  });

  it("rejects non-numeric or negative prices", () => {
    expect(sanitizeParsedFilters({ priceMax: -100 }, catalog)).toEqual({});
    expect(sanitizeParsedFilters({ priceMax: "2000000" }, catalog)).toEqual({});
  });

  it("returns an empty object for garbage input", () => {
    expect(sanitizeParsedFilters(null, catalog)).toEqual({});
    expect(sanitizeParsedFilters("not an object", catalog)).toEqual({});
    expect(sanitizeParsedFilters(42, catalog)).toEqual({});
  });

  it("keeps a free-text residual query when present", () => {
    expect(sanitizeParsedFilters({ q: "avec toit ouvrant" }, catalog)).toEqual({
      q: "avec toit ouvrant",
    });
  });
});

describe("parseNaturalLanguageQuery", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("falls back to a plain text search when no API key is configured (no regression)", async () => {
    const result = await parseNaturalLanguageQuery("clio diesel pas chère", catalog);
    expect(result).toEqual({ filters: { q: "clio diesel pas chère" }, source: "heuristic" });
  });
});
