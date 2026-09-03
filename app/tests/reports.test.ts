import { describe, expect, it } from "vitest";
import {
  checkCanReportUser,
  computeReportTransition,
  shouldAutoSuspendListing,
  shouldAutoSuspendUser,
  validateReportSubmission,
} from "@/lib/reports";

describe("validateReportSubmission", () => {
  it("accepts any reason other than AUTRE without a comment", () => {
    expect(validateReportSubmission({ reason: "PRIX_SUSPECT" })).toEqual({ ok: true });
    expect(validateReportSubmission({ reason: "VEHICULE_VOLE", comment: "" })).toEqual({ ok: true });
  });

  it("requires a comment when reason is AUTRE", () => {
    expect(validateReportSubmission({ reason: "AUTRE" })).toEqual({
      ok: false,
      error: "comment_required",
    });
    expect(validateReportSubmission({ reason: "AUTRE", comment: "   " })).toEqual({
      ok: false,
      error: "comment_required",
    });
  });

  it("accepts AUTRE with a non-empty comment", () => {
    expect(validateReportSubmission({ reason: "AUTRE", comment: "Annonce dupliquée trois fois" })).toEqual({
      ok: true,
    });
  });
});

describe("checkCanReportUser", () => {
  it("allows reporting another user", () => {
    expect(checkCanReportUser({ isSelf: false })).toEqual({ ok: true });
  });

  it("blocks reporting yourself", () => {
    expect(checkCanReportUser({ isSelf: true })).toEqual({ ok: false, error: "cannot_report_self" });
  });
});

describe("computeReportTransition", () => {
  it("resolves an open report", () => {
    expect(computeReportTransition("OUVERT", "resolve")).toEqual({ ok: true, newStatus: "TRAITE" });
  });

  it("dismisses an open report", () => {
    expect(computeReportTransition("OUVERT", "dismiss")).toEqual({ ok: true, newStatus: "REJETE" });
  });

  it("cannot transition an already-resolved report", () => {
    expect(computeReportTransition("TRAITE", "resolve")).toEqual({
      ok: false,
      error: "invalid_transition",
    });
    expect(computeReportTransition("TRAITE", "dismiss")).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });

  it("cannot transition an already-dismissed report", () => {
    expect(computeReportTransition("REJETE", "resolve")).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });
});

describe("shouldAutoSuspendListing", () => {
  it("does not suspend below the threshold", () => {
    expect(shouldAutoSuspendListing(0)).toBe(false);
    expect(shouldAutoSuspendListing(1)).toBe(false);
    expect(shouldAutoSuspendListing(2)).toBe(false);
  });

  it("suspends once the threshold is reached", () => {
    expect(shouldAutoSuspendListing(3)).toBe(true);
  });

  it("keeps suspending beyond the threshold", () => {
    expect(shouldAutoSuspendListing(10)).toBe(true);
  });
});

describe("shouldAutoSuspendUser", () => {
  it("does not suspend below the threshold", () => {
    expect(shouldAutoSuspendUser(0)).toBe(false);
    expect(shouldAutoSuspendUser(1)).toBe(false);
    expect(shouldAutoSuspendUser(2)).toBe(false);
  });

  it("suspends once the threshold is reached", () => {
    expect(shouldAutoSuspendUser(3)).toBe(true);
  });

  it("keeps suspending beyond the threshold", () => {
    expect(shouldAutoSuspendUser(10)).toBe(true);
  });
});
