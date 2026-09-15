import { describe, expect, it } from "vitest";
import { slugify, catalogue } from "../prisma/catalogue-data";

describe("slugify", () => {
  it("strips accents and lowercases", () => {
    expect(slugify("Citroën")).toBe("citroen");
  });

  it("replaces non-alphanumeric runs with a single hyphen", () => {
    expect(slugify("Mercedes-Benz")).toBe("mercedes-benz");
    expect(slugify("Série 3")).toBe("serie-3");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  208  ")).toBe("208");
  });
});

describe("catalogue data", () => {
  it("has unique brand slugs", () => {
    const slugs = catalogue.map((b) => slugify(b.brand));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has unique model slugs within each brand", () => {
    for (const { models } of catalogue) {
      const slugs = models.map((m) => slugify(typeof m === "string" ? m : m.name));
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("never gives a model an empty Arabic name (Lot 94)", () => {
    for (const { models } of catalogue) {
      for (const model of models) {
        if (typeof model !== "string") expect(model.nameAr.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
