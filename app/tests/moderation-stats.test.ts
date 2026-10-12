import { describe, expect, it } from "vitest";

import {
  computeAutoPublishRate,
  computeAvgModerationHours,
  bucketFraudScores,
  FRAUD_SCORE_RANGES,
} from "@/lib/moderation-stats";

describe("computeAutoPublishRate", () => {
  it("returns 0 when no decisions at all", () => {
    expect(computeAutoPublishRate(0, 0)).toBe(0);
  });

  it("returns 100 when all auto-published", () => {
    expect(computeAutoPublishRate(10, 0)).toBe(100);
  });

  it("returns 0 when all human-approved", () => {
    expect(computeAutoPublishRate(0, 10)).toBe(0);
  });

  it("rounds to nearest integer", () => {
    expect(computeAutoPublishRate(1, 2)).toBe(33);
    expect(computeAutoPublishRate(2, 1)).toBe(67);
  });

  it("handles large numbers", () => {
    expect(computeAutoPublishRate(999, 1)).toBe(100);
    expect(computeAutoPublishRate(1, 999)).toBe(0);
  });
});

describe("computeAvgModerationHours", () => {
  it("returns null when no pairs", () => {
    expect(computeAvgModerationHours([])).toBeNull();
  });

  it("computes average hours for a single pair", () => {
    const created = new Date("2026-10-01T10:00:00Z");
    const decided = new Date("2026-10-01T13:30:00Z");
    expect(computeAvgModerationHours([{ created, decided }])).toBe(3.5);
  });

  it("computes average across multiple pairs", () => {
    const pairs = [
      { created: new Date("2026-10-01T10:00:00Z"), decided: new Date("2026-10-01T12:00:00Z") },
      { created: new Date("2026-10-02T08:00:00Z"), decided: new Date("2026-10-02T14:00:00Z") },
    ];
    expect(computeAvgModerationHours(pairs)).toBe(4);
  });

  it("rounds to one decimal place", () => {
    const created = new Date("2026-10-01T10:00:00Z");
    const decided = new Date("2026-10-01T10:20:00Z");
    expect(computeAvgModerationHours([{ created, decided }])).toBe(0.3);
  });

  it("handles sub-hour durations", () => {
    const created = new Date("2026-10-01T10:00:00Z");
    const decided = new Date("2026-10-01T10:06:00Z");
    expect(computeAvgModerationHours([{ created, decided }])).toBe(0.1);
  });
});

describe("bucketFraudScores", () => {
  it("returns all zeroes for empty input", () => {
    const result = bucketFraudScores([]);
    expect(result).toHaveLength(FRAUD_SCORE_RANGES.length);
    expect(result.every((b) => b.count === 0)).toBe(true);
  });

  it("places score 0 in the first bucket", () => {
    const result = bucketFraudScores([0, 0, 0]);
    expect(result[0]).toEqual({ label: "0", min: 0, max: 0, count: 3 });
    expect(result.slice(1).every((b) => b.count === 0)).toBe(true);
  });

  it("places score 100 in the last bucket", () => {
    const result = bucketFraudScores([100]);
    expect(result[result.length - 1]).toEqual({ label: "81–100", min: 81, max: 100, count: 1 });
  });

  it("distributes scores across all buckets", () => {
    const scores = [0, 5, 15, 25, 35, 50, 65, 75, 85, 100];
    const result = bucketFraudScores(scores);
    expect(result.map((b) => b.count)).toEqual([1, 2, 2, 1, 2, 2]);
  });

  it("handles boundary values correctly", () => {
    const scores = [1, 20, 21, 40, 41, 60, 61, 80, 81, 100];
    const result = bucketFraudScores(scores);
    expect(result[0].count).toBe(0);
    expect(result[1].count).toBe(2);
    expect(result[2].count).toBe(2);
    expect(result[3].count).toBe(2);
    expect(result[4].count).toBe(2);
    expect(result[5].count).toBe(2);
  });

  it("preserves range metadata from FRAUD_SCORE_RANGES", () => {
    const result = bucketFraudScores([50]);
    for (let i = 0; i < result.length; i++) {
      expect(result[i].label).toBe(FRAUD_SCORE_RANGES[i].label);
      expect(result[i].min).toBe(FRAUD_SCORE_RANGES[i].min);
      expect(result[i].max).toBe(FRAUD_SCORE_RANGES[i].max);
    }
  });
});
