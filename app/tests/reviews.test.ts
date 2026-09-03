import { describe, expect, it } from "vitest";
import {
  checkReviewEligibility,
  computeAverageRating,
  isValidRating,
  validateReviewReply,
} from "@/lib/reviews";

describe("checkReviewEligibility", () => {
  it("allows a real buyer who has interacted with the seller", () => {
    expect(
      checkReviewEligibility({ isSelf: false, hasInteracted: true, alreadyReviewed: false })
    ).toEqual({ ok: true });
  });

  it("blocks reviewing yourself", () => {
    expect(
      checkReviewEligibility({ isSelf: true, hasInteracted: true, alreadyReviewed: false })
    ).toEqual({ ok: false, error: "cannot_review_self" });
  });

  it("blocks a second review from the same author", () => {
    expect(
      checkReviewEligibility({ isSelf: false, hasInteracted: true, alreadyReviewed: true })
    ).toEqual({ ok: false, error: "already_reviewed" });
  });

  it("blocks a review with no prior interaction", () => {
    expect(
      checkReviewEligibility({ isSelf: false, hasInteracted: false, alreadyReviewed: false })
    ).toEqual({ ok: false, error: "no_interaction" });
  });

  it("prioritizes self-check over interaction/already-reviewed checks", () => {
    expect(
      checkReviewEligibility({ isSelf: true, hasInteracted: false, alreadyReviewed: true })
    ).toEqual({ ok: false, error: "cannot_review_self" });
  });
});

describe("isValidRating", () => {
  it("accepts integers 1 to 5", () => {
    expect(isValidRating(1)).toBe(true);
    expect(isValidRating(5)).toBe(true);
    expect(isValidRating(3)).toBe(true);
  });

  it("rejects out-of-range or non-integer values", () => {
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(3.5)).toBe(false);
  });
});

describe("computeAverageRating", () => {
  it("returns zero average and count for no ratings", () => {
    expect(computeAverageRating([])).toEqual({ average: 0, count: 0 });
  });

  it("computes the average rounded to one decimal", () => {
    expect(computeAverageRating([5, 4, 4])).toEqual({ average: 4.3, count: 3 });
  });

  it("handles a single rating", () => {
    expect(computeAverageRating([3])).toEqual({ average: 3, count: 1 });
  });
});

describe("validateReviewReply", () => {
  it("rejects an empty or whitespace-only reply", () => {
    expect(validateReviewReply("")).toEqual({ ok: false, error: "reply_required" });
    expect(validateReviewReply("   ")).toEqual({ ok: false, error: "reply_required" });
  });

  it("rejects a reply longer than 1000 characters", () => {
    expect(validateReviewReply("A".repeat(1001))).toEqual({ ok: false, error: "reply_too_long" });
  });

  it("accepts a well-formed reply", () => {
    expect(validateReviewReply("Merci pour votre retour !")).toEqual({ ok: true });
    expect(validateReviewReply("A".repeat(1000))).toEqual({ ok: true });
  });
});
