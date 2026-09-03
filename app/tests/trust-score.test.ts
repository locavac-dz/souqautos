import { describe, expect, it } from "vitest";
import { accountAgeInDays, computeTrustScore } from "@/lib/trust-score";

describe("accountAgeInDays", () => {
  it("computes whole days between account creation and now", () => {
    expect(accountAgeInDays(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-11T00:00:00Z"))).toBe(10);
  });

  it("returns 0 for an account created just now", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(accountAgeInDays(now, now)).toBe(0);
  });
});

describe("computeTrustScore", () => {
  it("returns 0 for a brand-new account with no signals at all", () => {
    const result = computeTrustScore({
      emailVerified: false,
      phoneVerified: false,
      identityVerified: false,
      accountAgeDays: 0,
      reviewCount: 0,
      averageRating: 0,
      confirmedReportCount: 0,
    });
    expect(result.score).toBe(0);
  });

  it("caps an email+phone-verified, aged account with no identity or reviews at 35", () => {
    const result = computeTrustScore({
      emailVerified: true,
      phoneVerified: true,
      identityVerified: false,
      accountAgeDays: 365,
      reviewCount: 0,
      averageRating: 0,
      confirmedReportCount: 0,
    });
    expect(result).toEqual({
      score: 35,
      emailPoints: 10,
      phonePoints: 10,
      identityPoints: 0,
      agePoints: 15,
      reviewPoints: 0,
      reportPenalty: 0,
    });
  });

  it("caps a fully-verified account (incl. identity) with no reviews at 55", () => {
    const result = computeTrustScore({
      emailVerified: true,
      phoneVerified: true,
      identityVerified: true,
      accountAgeDays: 365,
      reviewCount: 0,
      averageRating: 0,
      confirmedReportCount: 0,
    });
    expect(result.identityPoints).toBe(20);
    expect(result.score).toBe(55);
  });

  it("reaches 100 with full verification, full age, and a perfect rating", () => {
    const result = computeTrustScore({
      emailVerified: true,
      phoneVerified: true,
      identityVerified: true,
      accountAgeDays: 400,
      reviewCount: 10,
      averageRating: 5,
      confirmedReportCount: 0,
    });
    expect(result.score).toBe(100);
  });

  it("prorates account age linearly up to the 180-day cap", () => {
    const result = computeTrustScore({
      emailVerified: false,
      phoneVerified: false,
      identityVerified: false,
      accountAgeDays: 90,
      reviewCount: 0,
      averageRating: 0,
      confirmedReportCount: 0,
    });
    expect(result.agePoints).toBe(7);
  });

  it("scales review points proportionally to the average rating", () => {
    const result = computeTrustScore({
      emailVerified: false,
      phoneVerified: false,
      identityVerified: false,
      accountAgeDays: 0,
      reviewCount: 3,
      averageRating: 2.5,
      confirmedReportCount: 0,
    });
    expect(result.reviewPoints).toBe(23);
  });

  it("subtracts 10 points per confirmed report", () => {
    const result = computeTrustScore({
      emailVerified: true,
      phoneVerified: true,
      identityVerified: false,
      accountAgeDays: 365,
      reviewCount: 0,
      averageRating: 0,
      confirmedReportCount: 2,
    });
    expect(result.reportPenalty).toBe(20);
    expect(result.score).toBe(15);
  });

  it("never goes below 0 even with many confirmed reports", () => {
    const result = computeTrustScore({
      emailVerified: false,
      phoneVerified: false,
      identityVerified: false,
      accountAgeDays: 0,
      reviewCount: 0,
      averageRating: 0,
      confirmedReportCount: 20,
    });
    expect(result.score).toBe(0);
  });
});
