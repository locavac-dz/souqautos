import { describe, expect, it } from "vitest";
import { validateThreshold } from "@/lib/moderation-settings";

describe("validateThreshold", () => {
  it("accepts a typical threshold", () => {
    expect(validateThreshold(3)).toEqual({ ok: true });
    expect(validateThreshold(5)).toEqual({ ok: true });
  });

  it("accepts the boundary values", () => {
    expect(validateThreshold(1)).toEqual({ ok: true });
    expect(validateThreshold(50)).toEqual({ ok: true });
  });

  it("rejects zero (would trigger suspension on a single unconfirmed report)", () => {
    expect(validateThreshold(0)).toEqual({ ok: false, error: "invalid_threshold" });
  });

  it("rejects a negative value", () => {
    expect(validateThreshold(-1)).toEqual({ ok: false, error: "invalid_threshold" });
  });

  it("rejects a value above the upper bound", () => {
    expect(validateThreshold(51)).toEqual({ ok: false, error: "invalid_threshold" });
  });

  it("rejects a non-integer value", () => {
    expect(validateThreshold(3.5)).toEqual({ ok: false, error: "invalid_threshold" });
  });
});
