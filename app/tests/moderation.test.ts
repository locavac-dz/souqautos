import { describe, expect, it } from "vitest";
import { computeModerationTransition } from "@/lib/moderation";

describe("computeModerationTransition — approve", () => {
  it("approves a pending listing", () => {
    const result = computeModerationTransition("EN_ATTENTE", "approve");
    expect(result).toEqual({ ok: true, newStatus: "PUBLIEE" });
  });

  it("reinstates a suspended listing", () => {
    const result = computeModerationTransition("SUSPENDUE", "approve");
    expect(result).toEqual({ ok: true, newStatus: "PUBLIEE" });
  });

  it("rejects approving an already-published listing", () => {
    const result = computeModerationTransition("PUBLIEE", "approve");
    expect(result).toEqual({ ok: false, error: "invalid_transition" });
  });

  it("rejects approving a draft", () => {
    const result = computeModerationTransition("BROUILLON", "approve");
    expect(result.ok).toBe(false);
  });
});

describe("computeModerationTransition — reject", () => {
  it("rejects a pending listing when a reason is given", () => {
    const result = computeModerationTransition("EN_ATTENTE", "reject", "Photos illisibles");
    expect(result).toEqual({ ok: true, newStatus: "REFUSEE" });
  });

  it("requires a non-empty reason", () => {
    expect(computeModerationTransition("EN_ATTENTE", "reject")).toEqual({
      ok: false,
      error: "reason_required",
    });
    expect(computeModerationTransition("EN_ATTENTE", "reject", "   ")).toEqual({
      ok: false,
      error: "reason_required",
    });
  });

  it("cannot reject a listing that is not pending", () => {
    const result = computeModerationTransition("PUBLIEE", "reject", "motif");
    expect(result).toEqual({ ok: false, error: "invalid_transition" });
  });
});

describe("computeModerationTransition — suspend", () => {
  it("suspends a published listing when a reason is given", () => {
    const result = computeModerationTransition("PUBLIEE", "suspend", "Signalement fraude");
    expect(result).toEqual({ ok: true, newStatus: "SUSPENDUE" });
  });

  it("requires a non-empty reason", () => {
    expect(computeModerationTransition("PUBLIEE", "suspend")).toEqual({
      ok: false,
      error: "reason_required",
    });
  });

  it("cannot suspend a listing that is not published", () => {
    const result = computeModerationTransition("EN_ATTENTE", "suspend", "motif");
    expect(result).toEqual({ ok: false, error: "invalid_transition" });
  });
});
