import { describe, expect, it } from "vitest";
import { buildShowcaseDescription, isShowcaseIndexable } from "@/lib/pro-showcase-seo";

describe("buildShowcaseDescription", () => {
  it("returns undefined when there is no presentation, so the caller can fall back", () => {
    expect(buildShowcaseDescription(null)).toBeUndefined();
    expect(buildShowcaseDescription("")).toBeUndefined();
    expect(buildShowcaseDescription("   \n  ")).toBeUndefined();
  });

  it("flattens a multi-line presentation onto one line", () => {
    expect(buildShowcaseDescription("Vente de véhicules\n\nneufs   et d'occasion")).toBe(
      "Vente de véhicules neufs et d'occasion"
    );
  });

  it("cuts a long presentation at 160 characters", () => {
    expect(buildShowcaseDescription("a".repeat(500))).toHaveLength(160);
  });
});

describe("isShowcaseIndexable", () => {
  it("indexes a showcase with at least one published listing", () => {
    expect(isShowcaseIndexable(1)).toBe(true);
  });

  it("does not index an empty showcase", () => {
    expect(isShowcaseIndexable(0)).toBe(false);
  });
});
