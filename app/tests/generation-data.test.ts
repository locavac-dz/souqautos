import { describe, expect, it } from "vitest";
import { generations } from "../prisma/generation-data";

const CURRENT_YEAR = new Date().getFullYear();

describe("generation data", () => {
  it("has no duplicate (modelId, name) pairs", () => {
    const keys = generations.map((g) => `${g.modelId}|${g.name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has a non-empty name and a positive modelId for every entry", () => {
    for (const g of generations) {
      expect(g.modelId).toBeGreaterThan(0);
      expect(g.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("has a plausible production start year for every entry", () => {
    for (const g of generations) {
      expect(g.yearStart).toBeGreaterThanOrEqual(1970);
      expect(g.yearStart).toBeLessThanOrEqual(CURRENT_YEAR + 1);
    }
  });

  it("never has an end year before the start year", () => {
    for (const g of generations) {
      if (g.yearEnd !== null) {
        expect(g.yearEnd).toBeGreaterThanOrEqual(g.yearStart);
      }
    }
  });

  it("covers exactly the 24 models used by the demo listings (documented partial coverage, cf. Lot 88)", () => {
    const modelIds = new Set(generations.map((g) => g.modelId));
    expect(modelIds.size).toBe(24);
  });
});
