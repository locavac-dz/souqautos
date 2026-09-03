import { describe, expect, it } from "vitest";
import { checkCanSubmitIdentityRequest, computeIdentityReviewTransition } from "@/lib/identity-verification";

describe("checkCanSubmitIdentityRequest", () => {
  it("allows a fresh submission", () => {
    expect(checkCanSubmitIdentityRequest({ alreadyVerified: false, hasPendingRequest: false })).toEqual({
      ok: true,
    });
  });

  it("blocks a submission when already verified", () => {
    expect(checkCanSubmitIdentityRequest({ alreadyVerified: true, hasPendingRequest: false })).toEqual({
      ok: false,
      error: "already_verified",
    });
  });

  it("blocks a submission while a request is pending", () => {
    expect(checkCanSubmitIdentityRequest({ alreadyVerified: false, hasPendingRequest: true })).toEqual({
      ok: false,
      error: "request_pending",
    });
  });

  it("prioritizes already-verified over a pending request", () => {
    expect(checkCanSubmitIdentityRequest({ alreadyVerified: true, hasPendingRequest: true })).toEqual({
      ok: false,
      error: "already_verified",
    });
  });
});

describe("computeIdentityReviewTransition", () => {
  it("approves a pending request", () => {
    expect(computeIdentityReviewTransition("EN_ATTENTE", "approve")).toEqual({
      ok: true,
      newStatus: "APPROUVEE",
    });
  });

  it("rejects a pending request when a reason is given", () => {
    expect(computeIdentityReviewTransition("EN_ATTENTE", "reject", "Photo illisible")).toEqual({
      ok: true,
      newStatus: "REFUSEE",
    });
  });

  it("requires a non-empty reason to reject", () => {
    expect(computeIdentityReviewTransition("EN_ATTENTE", "reject")).toEqual({
      ok: false,
      error: "reason_required",
    });
    expect(computeIdentityReviewTransition("EN_ATTENTE", "reject", "   ")).toEqual({
      ok: false,
      error: "reason_required",
    });
  });

  it("cannot review an already-approved request", () => {
    expect(computeIdentityReviewTransition("APPROUVEE", "approve")).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });

  it("cannot review an already-rejected request", () => {
    expect(computeIdentityReviewTransition("REFUSEE", "reject", "motif")).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });
});
