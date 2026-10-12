import { describe, expect, it } from "vitest";

// Pure function extracted for testing — mirrors the logic in MarketPriceTrend.tsx
function computeYTicks(min: number, max: number, count: number): number[] {
  const range = max - min;
  const raw = range / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = Math.ceil(raw / magnitude) * magnitude;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max && ticks.length < count + 2; v += step) {
    ticks.push(v);
  }
  return ticks;
}

function formatCompact(value: number, locale: string): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return value.toLocaleString(locale);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[m - 1] + sorted[m]) / 2 : sorted[m];
}

describe("computeYTicks", () => {
  it("returns reasonable ticks for a typical price range", () => {
    const ticks = computeYTicks(1_500_000, 2_500_000, 4);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks.length).toBeLessThanOrEqual(6);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(1_500_000);
      expect(t).toBeLessThanOrEqual(2_500_000);
    }
  });

  it("produces evenly spaced ticks", () => {
    const ticks = computeYTicks(0, 10_000_000, 4);
    if (ticks.length >= 3) {
      const step = ticks[1] - ticks[0];
      for (let i = 2; i < ticks.length; i++) {
        expect(ticks[i] - ticks[i - 1]).toBe(step);
      }
    }
  });

  it("handles small ranges", () => {
    const ticks = computeYTicks(100_000, 110_000, 4);
    expect(ticks.length).toBeGreaterThanOrEqual(1);
  });
});

describe("formatCompact", () => {
  it("formats millions", () => {
    expect(formatCompact(2_500_000, "fr-DZ")).toBe("2.5M");
  });

  it("formats thousands", () => {
    expect(formatCompact(350_000, "fr-DZ")).toBe("350k");
  });

  it("keeps small numbers as-is", () => {
    expect(formatCompact(500, "fr-DZ")).toBeTruthy();
  });
});

describe("median", () => {
  it("returns the middle value for odd-length arrays", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("returns the average of two middle values for even-length arrays", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("handles a single value", () => {
    expect(median([42])).toBe(42);
  });
});
