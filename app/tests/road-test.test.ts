import { describe, expect, it } from "vitest";
import { formatRating, isValidBulletList, isValidRating, splitLines, starsFromRating } from "@/lib/road-test";

describe("isValidRating", () => {
  it("accepts half-point steps from 0.5 to 5", () => {
    for (const rating of [0.5, 1, 3.5, 4.5, 5]) expect(isValidRating(rating)).toBe(true);
  });

  it("rejects out-of-range, non half-point and non-finite values", () => {
    for (const rating of [0, 5.5, -1, 3.3, 4.75, NaN, Infinity]) expect(isValidRating(rating)).toBe(false);
  });
});

describe("starsFromRating", () => {
  it("splits a rating into full, half and empty stars that always total 5", () => {
    expect(starsFromRating(3.5)).toEqual({ full: 3, half: true, empty: 1 });
    expect(starsFromRating(5)).toEqual({ full: 5, half: false, empty: 0 });
    expect(starsFromRating(0.5)).toEqual({ full: 0, half: true, empty: 4 });
    expect(starsFromRating(2)).toEqual({ full: 2, half: false, empty: 3 });
  });
});

describe("splitLines", () => {
  it("returns one trimmed item per non-empty line, whatever the line ending", () => {
    expect(splitLines("  Confort \r\n\r\nPrix\n  \nEquipement  ")).toEqual(["Confort", "Prix", "Equipement"]);
  });

  it("returns an empty list for blank text", () => {
    expect(splitLines(" \n \n")).toEqual([]);
  });
});

describe("isValidBulletList", () => {
  it("accepts 1 to 8 items of at most 200 characters", () => {
    expect(isValidBulletList("Un seul point")).toBe(true);
    expect(isValidBulletList(Array.from({ length: 8 }, (_, i) => `Point ${i}`).join("\n"))).toBe(true);
  });

  it("rejects an empty list, more than 8 items or an item over 200 characters", () => {
    expect(isValidBulletList("  \n ")).toBe(false);
    expect(isValidBulletList(Array.from({ length: 9 }, (_, i) => `Point ${i}`).join("\n"))).toBe(false);
    expect(isValidBulletList("x".repeat(201))).toBe(false);
  });
});

describe("formatRating", () => {
  it("uses the decimal comma in French and drops a useless .0", () => {
    expect(formatRating(3.5, "fr")).toBe("3,5");
    expect(formatRating(5, "fr")).toBe("5");
  });

  it("formats for Arabic without throwing", () => {
    expect(formatRating(4.5, "ar")).toMatch(/4.5/);
  });
});
