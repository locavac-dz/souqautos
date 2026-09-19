import { describe, expect, it } from "vitest";
import {
  STALE_DRAFT_DAYS,
  TARGET_DAYS,
  coveragePercent,
  daysSince,
  freshness,
  isStaleDraft,
  modelsWithoutGuide,
  parseModelParam,
  type ModelCoverage,
} from "@/lib/editorial";

const NOW = new Date("2026-09-19T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000);

describe("daysSince", () => {
  // NOW = 19 septembre 13 h (heure d'Algérie, UTC+1)
  it("counts calendar days in Algeria time: 0 the same day, 1 for yesterday, never negative", () => {
    expect(daysSince(NOW, NOW)).toBe(0);
    expect(daysSince(new Date("2026-09-19T07:00:00Z"), NOW)).toBe(0); // ce matin
    expect(daysSince(new Date("2026-09-18T23:30:00Z"), NOW)).toBe(0); // 00 h 30 le 19, heure d'Algérie
    expect(daysSince(daysAgo(1), NOW)).toBe(1);
    expect(daysSince(daysAgo(7), NOW)).toBe(7);
    expect(daysSince(new Date(NOW.getTime() + 5 * 86400000), NOW)).toBe(0);
  });

  it("says « yesterday » for last night's publication even when it is only a few hours old", () => {
    expect(daysSince(new Date("2026-09-18T22:30:00Z"), NOW)).toBe(1); // 23 h 30 le 18, heure d'Algérie : il y a 14 h seulement
  });

  it("crosses month and year boundaries", () => {
    expect(daysSince(new Date("2026-08-31T12:00:00Z"), new Date("2026-09-02T12:00:00Z"))).toBe(2);
    expect(daysSince(new Date("2025-12-31T12:00:00Z"), new Date("2026-01-01T12:00:00Z"))).toBe(1);
  });
});

describe("freshness", () => {
  it("says « empty » when nothing was ever published", () => {
    expect(freshness(null, 7, NOW)).toEqual({ status: "empty" });
  });

  it("is up to date on the day of the target and late the day after", () => {
    expect(freshness(daysAgo(7), 7, NOW)).toEqual({ status: "ok", daysSince: 7 });
    expect(freshness(daysAgo(8), 7, NOW)).toEqual({ status: "late", daysSince: 8, overdueBy: 1 });
    expect(freshness(daysAgo(0), 7, NOW)).toEqual({ status: "ok", daysSince: 0 });
  });

  it("reports by how many days the target is exceeded", () => {
    expect(freshness(daysAgo(45), 30, NOW)).toEqual({ status: "late", daysSince: 45, overdueBy: 15 });
  });

  it("has a weekly target for the press review, as the editorial team decided", () => {
    expect(TARGET_DAYS.press).toBe(7);
    for (const days of Object.values(TARGET_DAYS)) expect(days).toBeGreaterThan(0);
  });
});

describe("isStaleDraft", () => {
  it("flags a draft untouched for 14 days or more", () => {
    expect(STALE_DRAFT_DAYS).toBe(14);
    expect(isStaleDraft(daysAgo(13), NOW)).toBe(false);
    expect(isStaleDraft(daysAgo(14), NOW)).toBe(true);
    expect(isStaleDraft(daysAgo(90), NOW)).toBe(true);
  });
});

const model = (o: Partial<ModelCoverage> & { modelId: number }): ModelCoverage => ({
  brandName: "Renault",
  modelName: `Modèle ${o.modelId}`,
  brandSlug: "renault",
  modelSlug: `modele-${o.modelId}`,
  listings: 0,
  views: 0,
  guides: 0,
  roadTests: 0,
  pressReviews: 0,
  ...o,
});

describe("modelsWithoutGuide", () => {
  it("keeps only models without a published guide", () => {
    const result = modelsWithoutGuide([model({ modelId: 1, listings: 5, guides: 1 }), model({ modelId: 2, listings: 3 })]);
    expect(result.map((m) => m.modelId)).toEqual([2]);
  });

  it("puts the most present models first, then the most viewed, then by name for a stable order", () => {
    const result = modelsWithoutGuide([
      model({ modelId: 1, listings: 2, views: 900 }),
      model({ modelId: 2, listings: 9, views: 1 }),
      model({ modelId: 3, listings: 2, views: 50 }),
      model({ modelId: 4, listings: 2, views: 50, brandName: "Audi", modelName: "Q3" }),
    ]);
    expect(result.map((m) => m.modelId)).toEqual([2, 1, 4, 3]);
  });

  it("does not modify its input", () => {
    const input = [model({ modelId: 1, listings: 1 }), model({ modelId: 2, listings: 5 })];
    modelsWithoutGuide(input);
    expect(input.map((m) => m.modelId)).toEqual([1, 2]);
  });

  it("is empty when every model has a guide, or when there is none", () => {
    expect(modelsWithoutGuide([model({ modelId: 1, guides: 2 })])).toEqual([]);
    expect(modelsWithoutGuide([])).toEqual([]);
  });
});

describe("coveragePercent", () => {
  it("gives the share of models on the site that have a guide", () => {
    expect(coveragePercent(1, 4)).toBe(25);
    expect(coveragePercent(0, 24)).toBe(0);
    expect(coveragePercent(24, 24)).toBe(100);
    expect(coveragePercent(1, 3)).toBe(33);
  });

  it("says nothing when no model is on the site, and never exceeds 100 %", () => {
    expect(coveragePercent(0, 0)).toBeNull();
    expect(coveragePercent(3, 0)).toBeNull();
    expect(coveragePercent(9, 4)).toBe(100);
  });
});

describe("parseModelParam", () => {
  it("accepts a positive integer from the address", () => {
    expect(parseModelParam("12")).toBe(12);
    expect(parseModelParam(["7", "9"])).toBe(7);
  });

  it("ignores everything else instead of failing", () => {
    for (const raw of [undefined, "", "0", "-3", "1.5", "abc", "12abc", "1e3", "12345678901", " 5", "0x10", "٣"]) {
      expect(parseModelParam(raw), String(raw)).toBeNull();
    }
  });
});
