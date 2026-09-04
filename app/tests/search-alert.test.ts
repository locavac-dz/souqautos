import { describe, expect, it } from "vitest";
import {
  createSearchAlertSchema,
  sanitizeAlertFilters,
  hasAtLeastOneFilter,
  MAX_ALERTS_PER_USER,
} from "@/lib/validation/search-alert";

describe("sanitizeAlertFilters", () => {
  it("keeps only recognized filter keys", () => {
    expect(
      sanitizeAlertFilters({ brandId: "3", wilayaId: "16", page: "2", sort: "price_asc", bogus: "x" })
    ).toEqual({ brandId: "3", wilayaId: "16" });
  });

  it("drops empty-string values", () => {
    expect(sanitizeAlertFilters({ q: "", brandId: "3" })).toEqual({ brandId: "3" });
  });

  it("returns an empty object when nothing recognized is present", () => {
    expect(sanitizeAlertFilters({ page: "2", sort: "recent" })).toEqual({});
  });
});

describe("hasAtLeastOneFilter", () => {
  it("rejects an empty filter set (correspondrait à toute nouvelle annonce)", () => {
    expect(hasAtLeastOneFilter({})).toBe(false);
  });

  it("accepts a filter set with at least one criterion", () => {
    expect(hasAtLeastOneFilter({ wilayaId: "16" })).toBe(true);
  });
});

describe("createSearchAlertSchema", () => {
  it("accepts a valid label and filters", () => {
    const result = createSearchAlertSchema.safeParse({
      label: "Clio à Alger",
      filters: { brandId: "3", wilayaId: "16" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a label that is too short", () => {
    const result = createSearchAlertSchema.safeParse({ label: "A", filters: {} });
    expect(result.success).toBe(false);
  });

  it("rejects a missing filters object", () => {
    const result = createSearchAlertSchema.safeParse({ label: "Clio à Alger" });
    expect(result.success).toBe(false);
  });
});

describe("MAX_ALERTS_PER_USER", () => {
  it("is a small, positive limit", () => {
    expect(MAX_ALERTS_PER_USER).toBeGreaterThan(0);
    expect(MAX_ALERTS_PER_USER).toBeLessThanOrEqual(20);
  });
});
