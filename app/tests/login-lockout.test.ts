import { describe, expect, it } from "vitest";
import {
  isAccountLocked,
  computeFailedLoginUpdate,
  LOCKOUT_THRESHOLD,
  LOCKOUT_DURATION_MS,
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

describe("computeFailedLoginUpdate", () => {
  const now = new Date("2026-09-16T12:00:00Z");

  it("increments the counter without locking below the threshold", () => {
    for (let attempts = 0; attempts < LOCKOUT_THRESHOLD - 1; attempts++) {
      const result = computeFailedLoginUpdate(attempts, now);
      expect(result.failedLoginAttempts).toBe(attempts + 1);
      expect(result.lockedUntil).toBeNull();
    }
  });

  it("locks the account once the threshold is reached", () => {
    const result = computeFailedLoginUpdate(LOCKOUT_THRESHOLD - 1, now);
    expect(result.failedLoginAttempts).toBe(LOCKOUT_THRESHOLD);
    expect(result.lockedUntil).toEqual(new Date(now.getTime() + LOCKOUT_DURATION_MS));
  });

  it("keeps locking (and extending) past the threshold, never un-locks by itself", () => {
    const result = computeFailedLoginUpdate(LOCKOUT_THRESHOLD, now);
    expect(result.failedLoginAttempts).toBe(LOCKOUT_THRESHOLD + 1);
    expect(result.lockedUntil).toEqual(new Date(now.getTime() + LOCKOUT_DURATION_MS));
  });
});
