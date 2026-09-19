import { describe, expect, it } from "vitest";
import {
  MILEAGE_STEPS_KM,
  PRICE_STEPS_DZD,
  normalizeFilterValue,
  optionsWithCurrent,
  yearOptions,
} from "@/lib/search-filter-options";

describe("yearOptions", () => {
  it("runs from the current year down to 1990, most recent first", () => {
    const years = yearOptions(2026);
    expect(years[0]).toBe(2026);
    expect(years[years.length - 1]).toBe(1990);
    expect(years).toHaveLength(37);
  });
});

describe("filter steps", () => {
  it("are strictly increasing so the dropdowns read naturally", () => {
    for (const steps of [PRICE_STEPS_DZD, MILEAGE_STEPS_KM]) {
      expect(steps.every((value, i) => i === 0 || value > steps[i - 1])).toBe(true);
    }
  });
});

describe("normalizeFilterValue", () => {
  it("keeps a positive integer as a clean string", () => {
    expect(normalizeFilterValue("1500000")).toBe("1500000");
    expect(normalizeFilterValue("007")).toBe("7");
  });

  it("treats 0, empty, undefined and non-numeric values as no filter", () => {
    for (const value of ["0", "", undefined, "abc", "-5", "1.5", " 12"]) {
      expect(normalizeFilterValue(value)).toBe("");
    }
  });
});

describe("optionsWithCurrent", () => {
  it("returns the steps unchanged when the current value is one of them or absent", () => {
    expect(optionsWithCurrent(PRICE_STEPS_DZD, "1000000")).toBe(PRICE_STEPS_DZD);
    expect(optionsWithCurrent(PRICE_STEPS_DZD, undefined)).toBe(PRICE_STEPS_DZD);
    expect(optionsWithCurrent(PRICE_STEPS_DZD, "0")).toBe(PRICE_STEPS_DZD);
  });

  it("inserts a value from the address that is not a step, at its sorted place", () => {
    const result = optionsWithCurrent([500_000, 1_000_000, 2_000_000], "1234567");
    expect(result).toEqual([500_000, 1_000_000, 1_234_567, 2_000_000]);
  });

  it("keeps descending order for the year menus", () => {
    expect(optionsWithCurrent([2026, 2025, 2024], "2030", "desc")).toEqual([2030, 2026, 2025, 2024]);
    expect(optionsWithCurrent([2026, 2025, 2024], "1985", "desc")).toEqual([2026, 2025, 2024, 1985]);
  });
});
