import { describe, expect, it } from "vitest";
import { checkPhoneCode, generateExpiry, generateNumericCode, isExpired } from "@/lib/verification";

describe("isExpired", () => {
  it("is not expired before the expiry time", () => {
    expect(isExpired(new Date("2026-01-01T00:10:00Z"), new Date("2026-01-01T00:00:00Z"))).toBe(false);
  });

  it("is expired after the expiry time", () => {
    expect(isExpired(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-01T00:10:00Z"))).toBe(true);
  });
});

describe("generateExpiry", () => {
  it("adds the given number of minutes to now", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(generateExpiry(10, now)).toEqual(new Date("2026-01-01T00:10:00Z"));
  });
});

describe("generateNumericCode", () => {
  it("generates a 6-digit numeric string by default", () => {
    const code = generateNumericCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("generates a code of the requested length", () => {
    expect(generateNumericCode(4)).toMatch(/^\d{4}$/);
  });
});

describe("checkPhoneCode", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const expiresAt = new Date("2026-01-01T00:10:00Z");

  it("accepts a matching, non-expired code under the attempt limit", () => {
    expect(
      checkPhoneCode({ submittedCode: "123456", storedCode: "123456", expiresAt, attempts: 0, now })
    ).toEqual({ ok: true });
  });

  it("rejects a mismatched code", () => {
    expect(
      checkPhoneCode({ submittedCode: "000000", storedCode: "123456", expiresAt, attempts: 0, now })
    ).toEqual({ ok: false, error: "invalid_code" });
  });

  it("rejects an expired code even if it matches", () => {
    expect(
      checkPhoneCode({
        submittedCode: "123456",
        storedCode: "123456",
        expiresAt: new Date("2025-12-31T23:00:00Z"),
        attempts: 0,
        now,
      })
    ).toEqual({ ok: false, error: "expired" });
  });

  it("rejects once the attempt limit is reached, even with the right code", () => {
    expect(
      checkPhoneCode({ submittedCode: "123456", storedCode: "123456", expiresAt, attempts: 5, now })
    ).toEqual({ ok: false, error: "too_many_attempts" });
  });

  it("prioritizes too-many-attempts over expiry over mismatch", () => {
    expect(
      checkPhoneCode({
        submittedCode: "000000",
        storedCode: "123456",
        expiresAt: new Date("2025-12-31T23:00:00Z"),
        attempts: 5,
        now,
      })
    ).toEqual({ ok: false, error: "too_many_attempts" });
  });
});
