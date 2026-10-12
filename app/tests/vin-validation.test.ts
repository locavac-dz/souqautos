import { describe, expect, it } from "vitest";
import { isValidVin, normalizeVin } from "@/lib/validation/vin";
import { detectDuplicateVin } from "@/lib/fraud-signals";

describe("normalizeVin", () => {
  it("uppercases and strips spaces", () => {
    expect(normalizeVin("1hgbh 41jxmn109186")).toBe("1HGBH41JXMN109186");
  });
});

describe("isValidVin", () => {
  it("accepts a valid VIN with correct check digit", () => {
    expect(isValidVin("1HGBH41JXMN109186")).toBe(true);
  });

  it("rejects a VIN with wrong check digit", () => {
    expect(isValidVin("1HGBH41J0MN109186")).toBe(false);
  });

  it("rejects a VIN with forbidden characters I, O, Q", () => {
    expect(isValidVin("1HGBH41IXMN109186")).toBe(false);
    expect(isValidVin("1HGBH41OXMN109186")).toBe(false);
    expect(isValidVin("1HGBH41QXMN109186")).toBe(false);
  });

  it("rejects a VIN shorter than 17 characters", () => {
    expect(isValidVin("1HGBH41JXMN1091")).toBe(false);
  });

  it("rejects a VIN longer than 17 characters", () => {
    expect(isValidVin("1HGBH41JXMN1091860")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidVin("")).toBe(false);
  });

  it("accepts another known valid VIN", () => {
    expect(isValidVin("11111111111111111")).toBe(true);
  });
});

describe("detectDuplicateVin", () => {
  it("returns false when vin is null", () => {
    expect(detectDuplicateVin("listing-1", null, [{ id: "listing-2", vin: "1HGBH41JXMN109186" }])).toBe(false);
  });

  it("returns false when no other listing has the same VIN", () => {
    expect(detectDuplicateVin("listing-1", "1HGBH41JXMN109186", [{ id: "listing-2", vin: "WVWZZZ3CZWE123456" }])).toBe(false);
  });

  it("returns true when another listing has the same VIN", () => {
    expect(detectDuplicateVin("listing-1", "1HGBH41JXMN109186", [{ id: "listing-2", vin: "1HGBH41JXMN109186" }])).toBe(true);
  });

  it("returns false when the only match is the listing itself", () => {
    expect(detectDuplicateVin("listing-1", "1HGBH41JXMN109186", [{ id: "listing-1", vin: "1HGBH41JXMN109186" }])).toBe(false);
  });

  it("returns false when other listing has null vin", () => {
    expect(detectDuplicateVin("listing-1", "1HGBH41JXMN109186", [{ id: "listing-2", vin: null }])).toBe(false);
  });
});
