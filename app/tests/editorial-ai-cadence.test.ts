import { describe, expect, it } from "vitest";
import { aiCadenceStatus, AI_CADENCE, AI_CADENCE_KEYS } from "@/lib/editorial-ai-cadence";

const NOW = new Date("2026-10-12T10:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("aiCadenceStatus", () => {
  it("returns due with 0 overdue when no draft exists", () => {
    const result = aiCadenceStatus(null, 7, NOW);
    expect(result).toEqual({ status: "due", overdueDays: 0 });
  });

  it("returns ok when last draft is recent", () => {
    const lastCreated = new Date(NOW.getTime() - 3 * DAY_MS);
    const result = aiCadenceStatus(lastCreated, 7, NOW);
    expect(result).toEqual({ status: "ok", daysUntilNext: 4 });
  });

  it("returns due when interval is exactly reached", () => {
    const lastCreated = new Date(NOW.getTime() - 7 * DAY_MS);
    const result = aiCadenceStatus(lastCreated, 7, NOW);
    expect(result).toEqual({ status: "due", overdueDays: 0 });
  });

  it("returns due with overdue days when past interval", () => {
    const lastCreated = new Date(NOW.getTime() - 10 * DAY_MS);
    const result = aiCadenceStatus(lastCreated, 7, NOW);
    expect(result).toEqual({ status: "due", overdueDays: 3 });
  });

  it("returns ok with 1 day remaining at boundary", () => {
    const lastCreated = new Date(NOW.getTime() - 6 * DAY_MS);
    const result = aiCadenceStatus(lastCreated, 7, NOW);
    expect(result).toEqual({ status: "ok", daysUntilNext: 1 });
  });

  it("works with 30-day guide interval", () => {
    const lastCreated = new Date(NOW.getTime() - 15 * DAY_MS);
    const result = aiCadenceStatus(lastCreated, 30, NOW);
    expect(result).toEqual({ status: "ok", daysUntilNext: 15 });
  });
});

describe("AI_CADENCE constants", () => {
  it("has 3 cadence keys", () => {
    expect(AI_CADENCE_KEYS).toHaveLength(3);
  });

  it("magArticle and pressReview have 7-day intervals", () => {
    expect(AI_CADENCE.magArticle.intervalDays).toBe(7);
    expect(AI_CADENCE.pressReview.intervalDays).toBe(7);
  });

  it("guide has 30-day interval", () => {
    expect(AI_CADENCE.guide.intervalDays).toBe(30);
  });
});
