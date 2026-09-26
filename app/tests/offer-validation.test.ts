import { describe, expect, it } from "vitest";
import { makeOfferSchema, respondOfferSchema, updateOfferSchema } from "@/lib/validation/offer";

describe("makeOfferSchema", () => {
  it("accepts a valid amount", () => {
    expect(makeOfferSchema.safeParse({ amount: 500_000 }).success).toBe(true);
  });

  it("rejects zero and negative amounts", () => {
    expect(makeOfferSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(makeOfferSchema.safeParse({ amount: -1 }).success).toBe(false);
  });

  it("rejects amounts above the maximum", () => {
    expect(makeOfferSchema.safeParse({ amount: 1_000_000_001 }).success).toBe(false);
  });

  it("rejects non-integer amounts", () => {
    expect(makeOfferSchema.safeParse({ amount: 1.5 }).success).toBe(false);
  });

  it("accepts an optional message within the length limit", () => {
    expect(makeOfferSchema.safeParse({ amount: 1, message: "Bonjour" }).success).toBe(true);
    expect(makeOfferSchema.safeParse({ amount: 1, message: "a".repeat(500) }).success).toBe(true);
  });

  it("rejects a message exceeding the length limit", () => {
    expect(makeOfferSchema.safeParse({ amount: 1, message: "a".repeat(501) }).success).toBe(false);
  });
});

describe("respondOfferSchema", () => {
  it("accepts ACCEPTED, DECLINED and WITHDRAWN without counterAmount", () => {
    for (const action of ["ACCEPTED", "DECLINED", "WITHDRAWN"] as const) {
      expect(respondOfferSchema.safeParse({ action }).success).toBe(true);
    }
  });

  it("accepts COUNTERED with a valid counterAmount", () => {
    expect(respondOfferSchema.safeParse({ action: "COUNTERED", counterAmount: 350_000 }).success).toBe(true);
  });

  it("rejects COUNTERED without counterAmount", () => {
    expect(respondOfferSchema.safeParse({ action: "COUNTERED" }).success).toBe(false);
  });

  it("rejects COUNTERED with zero or negative counterAmount", () => {
    expect(respondOfferSchema.safeParse({ action: "COUNTERED", counterAmount: 0 }).success).toBe(false);
    expect(respondOfferSchema.safeParse({ action: "COUNTERED", counterAmount: -1 }).success).toBe(false);
  });

  it("rejects an unknown action", () => {
    expect(respondOfferSchema.safeParse({ action: "IGNORED" }).success).toBe(false);
  });
});

describe("updateOfferSchema", () => {
  it("accepts a valid amount with or without a message", () => {
    expect(updateOfferSchema.safeParse({ amount: 200_000 }).success).toBe(true);
    expect(updateOfferSchema.safeParse({ amount: 200_000, message: "Je confirme." }).success).toBe(true);
  });

  it("rejects zero, negative, non-integer and above-maximum amounts", () => {
    expect(updateOfferSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(updateOfferSchema.safeParse({ amount: -100 }).success).toBe(false);
    expect(updateOfferSchema.safeParse({ amount: 0.5 }).success).toBe(false);
    expect(updateOfferSchema.safeParse({ amount: 1_000_000_001 }).success).toBe(false);
  });
});
