import { describe, expect, it } from "vitest";
import {
  isAccountLocked,
  lockedUntilForAttempts,
  LOCKOUT_THRESHOLD,
  LOCKOUT_DURATION_MS,
  LOGIN_ACCOUNT_LIMIT,
} from "@/lib/login-lockout";

describe("isAccountLocked", () => {
  const now = new Date("2026-09-16T12:00:00Z");

  it("is not locked when lockedUntil is null", () => {
    expect(isAccountLocked(null, now)).toBe(false);
  });

  it("is not locked when lockedUntil is in the past", () => {
    expect(isAccountLocked(new Date("2026-09-16T11:59:00Z"), now)).toBe(false);
  });

  it("is locked when lockedUntil is in the future", () => {
    expect(isAccountLocked(new Date("2026-09-16T12:01:00Z"), now)).toBe(true);
  });
});

describe("lockedUntilForAttempts", () => {
  const now = new Date("2026-09-16T12:00:00Z");

  it("does not lock below the threshold", () => {
    for (let attempts = 1; attempts < LOCKOUT_THRESHOLD; attempts++) {
      expect(lockedUntilForAttempts(attempts, now)).toBeNull();
    }
  });

  it("locks the account once the counted attempts reach the threshold", () => {
    expect(lockedUntilForAttempts(LOCKOUT_THRESHOLD, now)).toEqual(new Date(now.getTime() + LOCKOUT_DURATION_MS));
  });

  it("keeps locking (and extending) past the threshold, never un-locks by itself", () => {
    expect(lockedUntilForAttempts(LOCKOUT_THRESHOLD + 3, now)).toEqual(new Date(now.getTime() + LOCKOUT_DURATION_MS));
  });
});

describe("LOGIN_ACCOUNT_LIMIT", () => {
  it("allows more attempts than the lockout threshold, so normal use never hits it, but stays a small bound", () => {
    expect(LOGIN_ACCOUNT_LIMIT.limit).toBeGreaterThan(LOCKOUT_THRESHOLD);
    expect(LOGIN_ACCOUNT_LIMIT.limit).toBeLessThanOrEqual(50);
    expect(LOGIN_ACCOUNT_LIMIT.windowMs).toBe(15 * 60 * 1000);
  });
});
