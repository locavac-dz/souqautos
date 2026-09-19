import { describe, expect, it } from "vitest";
import { INT4_MAX, parsePositiveIntId } from "@/lib/validation/int-bounds";

describe("parsePositiveIntId", () => {
  it("accepts positive integers written with digits only", () => {
    expect(parsePositiveIntId("1")).toBe(1);
    expect(parsePositiveIntId("42")).toBe(42);
    expect(parsePositiveIntId(String(INT4_MAX))).toBe(INT4_MAX);
  });

  it("refuses a value above the 32-bit range instead of letting the database fail", () => {
    expect(parsePositiveIntId(String(INT4_MAX + 1))).toBeNull();
    expect(parsePositiveIntId("99999999999")).toBeNull();
    expect(parsePositiveIntId("9".repeat(400))).toBeNull();
  });

  it("refuses a fractional id — the database rounded « 1.5 » and acted on row 1 or 2", () => {
    for (const value of ["1.5", "1.0", "2.", ".5", "1e3", "0x10"]) {
      expect(parsePositiveIntId(value)).toBeNull();
    }
  });

  it("refuses zero, negatives, empty, padded and non-numeric values", () => {
    for (const value of ["0", "-1", "", " 1", "1 ", "007", "abc", "1a", "+1", "NaN", "Infinity"]) {
      expect(parsePositiveIntId(value)).toBeNull();
    }
  });
});
