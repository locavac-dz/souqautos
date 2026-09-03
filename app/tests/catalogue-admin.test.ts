import { describe, expect, it } from "vitest";
import { validateCatalogueName } from "@/lib/catalogue-admin";
import { slugify } from "@/lib/slugify";

describe("validateCatalogueName", () => {
  it("rejects an empty or whitespace-only name", () => {
    expect(validateCatalogueName("")).toEqual({ ok: false, error: "name_required" });
    expect(validateCatalogueName("   ")).toEqual({ ok: false, error: "name_required" });
  });

  it("rejects a single-character name", () => {
    expect(validateCatalogueName("A")).toEqual({ ok: false, error: "name_required" });
  });

  it("rejects a name longer than 60 characters", () => {
    expect(validateCatalogueName("A".repeat(61))).toEqual({ ok: false, error: "name_too_long" });
  });

  it("accepts a well-formed name", () => {
    expect(validateCatalogueName("Renault")).toEqual({ ok: true });
    expect(validateCatalogueName("A".repeat(60))).toEqual({ ok: true });
  });
});

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Renault Clio")).toBe("renault-clio");
  });

  it("strips accents", () => {
    expect(slugify("Škoda Octávia")).toBe("skoda-octavia");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  DS ")).toBe("ds");
  });
});
