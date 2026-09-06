import { describe, expect, it } from "vitest";
import { validateQuota } from "@/lib/pro-subscription-settings";

describe("validateQuota", () => {
  it("accepts a reasonable positive integer", () => {
    expect(validateQuota(5)).toEqual({ ok: true });
  });

  it("rejects zero and negative values", () => {
    expect(validateQuota(0)).toEqual({ ok: false, error: "invalid_quota" });
    expect(validateQuota(-1)).toEqual({ ok: false, error: "invalid_quota" });
  });

  it("rejects a non-integer value", () => {
    expect(validateQuota(5.5)).toEqual({ ok: false, error: "invalid_quota" });
  });

  it("rejects a value above the upper bound", () => {
    expect(validateQuota(100_001)).toEqual({ ok: false, error: "invalid_quota" });
  });

  it("accepts the exact upper bound", () => {
    expect(validateQuota(100_000)).toEqual({ ok: true });
  });
});
