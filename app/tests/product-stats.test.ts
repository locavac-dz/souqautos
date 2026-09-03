import { describe, expect, it } from "vitest";
import { bucketByWeek } from "@/lib/product-stats";

describe("bucketByWeek", () => {
  // Lundi 2026-01-05 — choisi comme point de repère fixe pour tous les tests.
  const now = new Date("2026-01-05T12:00:00Z");

  it("returns the requested number of buckets, oldest first", () => {
    const buckets = bucketByWeek([], 4, now);
    expect(buckets).toHaveLength(4);
    expect(buckets[3].weekStart.getTime()).toBeGreaterThan(buckets[0].weekStart.getTime());
  });

  it("returns zero counts when there are no dates", () => {
    const buckets = bucketByWeek([], 3, now);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });

  it("counts a date into the current week when it falls in the same Mon-Sun span", () => {
    const buckets = bucketByWeek([new Date("2026-01-06T08:00:00Z")], 1, now);
    expect(buckets[0].count).toBe(1);
  });

  it("counts a date into the correct past week", () => {
    // 2025-12-22 (lundi) est exactement 2 semaines avant le 2026-01-05.
    const buckets = bucketByWeek([new Date("2025-12-24T00:00:00Z")], 3, now);
    expect(buckets[0].count).toBe(1); // semaine la plus ancienne des 3
    expect(buckets[1].count).toBe(0);
    expect(buckets[2].count).toBe(0);
  });

  it("ignores dates older than the requested window", () => {
    const buckets = bucketByWeek([new Date("2025-01-01T00:00:00Z")], 2, now);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });

  it("accumulates multiple dates in the same week", () => {
    const buckets = bucketByWeek(
      [new Date("2026-01-05T01:00:00Z"), new Date("2026-01-07T23:00:00Z"), new Date("2026-01-11T10:00:00Z")],
      1,
      now
    );
    expect(buckets[0].count).toBe(3);
  });

  it("is not affected by the order of input dates", () => {
    const a = bucketByWeek(
      [new Date("2026-01-06T00:00:00Z"), new Date("2025-12-30T00:00:00Z")],
      2,
      now
    );
    const b = bucketByWeek(
      [new Date("2025-12-30T00:00:00Z"), new Date("2026-01-06T00:00:00Z")],
      2,
      now
    );
    expect(a).toEqual(b);
  });
});
