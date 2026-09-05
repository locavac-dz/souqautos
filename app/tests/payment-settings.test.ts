import { describe, expect, it } from "vitest";
import { isBankDetailsComplete, validatePriceDzd } from "@/lib/payment-settings";

describe("isBankDetailsComplete", () => {
  it("is false when nothing has been configured yet (never invent bank details)", () => {
    expect(
      isBankDetailsComplete({
        bankName: null,
        bankRib: null,
        bankAccountHolder: null,
        premiumPriceDzd: 1000,
        premiumPlusPriceDzd: 2000,
      })
    ).toBe(false);
  });

  it("is false when only some fields are set", () => {
    expect(
      isBankDetailsComplete({
        bankName: "Banque Test",
        bankRib: null,
        bankAccountHolder: "EURL INGENICA CIVIL",
        premiumPriceDzd: 1000,
        premiumPlusPriceDzd: 2000,
      })
    ).toBe(false);
  });

  it("is true once all three fields are set", () => {
    expect(
      isBankDetailsComplete({
        bankName: "Banque Test",
        bankRib: "007 00000 0000000000 00",
        bankAccountHolder: "EURL INGENICA CIVIL",
        premiumPriceDzd: 1000,
        premiumPlusPriceDzd: 2000,
      })
    ).toBe(true);
  });
});

describe("validatePriceDzd", () => {
  it("accepts a reasonable positive integer price", () => {
    expect(validatePriceDzd(1500)).toEqual({ ok: true });
  });

  it("rejects zero, negative, non-integer, or absurdly large values", () => {
    expect(validatePriceDzd(0)).toEqual({ ok: false, error: "invalid_price" });
    expect(validatePriceDzd(-100)).toEqual({ ok: false, error: "invalid_price" });
    expect(validatePriceDzd(10.5)).toEqual({ ok: false, error: "invalid_price" });
    expect(validatePriceDzd(10_000_000)).toEqual({ ok: false, error: "invalid_price" });
  });
});
