import { describe, expect, it } from "vitest";
import { PRESS_REVIEW_TEMPLATES, pickNextPressReviewTopic } from "@/lib/editorial-press-topics";

describe("PRESS_REVIEW_TEMPLATES", () => {
  it("has at least 8 topics", () => {
    expect(PRESS_REVIEW_TEMPLATES.length).toBeGreaterThanOrEqual(8);
  });

  it("each topic has a non-empty key and prompt", () => {
    for (const t of PRESS_REVIEW_TEMPLATES) {
      expect(t.key.length).toBeGreaterThan(0);
      expect(t.promptFr.length).toBeGreaterThan(20);
    }
  });

  it("keys are unique", () => {
    const keys = PRESS_REVIEW_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keys do not overlap with MAG_TOPIC_TEMPLATES keys", async () => {
    const { MAG_TOPIC_TEMPLATES } = await import("@/lib/editorial-topics");
    const magKeys = new Set(MAG_TOPIC_TEMPLATES.map((t) => t.key));
    for (const t of PRESS_REVIEW_TEMPLATES) {
      expect(magKeys.has(t.key)).toBe(false);
    }
  });
});

describe("pickNextPressReviewTopic", () => {
  it("returns the first topic when no recent keys", () => {
    const topic = pickNextPressReviewTopic([]);
    expect(topic.key).toBe(PRESS_REVIEW_TEMPLATES[0].key);
  });

  it("skips recent keys and returns the next unused topic", () => {
    const recent = PRESS_REVIEW_TEMPLATES.slice(0, 3).map((t) => t.key);
    const topic = pickNextPressReviewTopic(recent);
    expect(topic.key).toBe(PRESS_REVIEW_TEMPLATES[3].key);
  });

  it("wraps around when all keys are recent", () => {
    const allKeys = PRESS_REVIEW_TEMPLATES.map((t) => t.key);
    const topic = pickNextPressReviewTopic(allKeys);
    expect(topic.key).toBe(PRESS_REVIEW_TEMPLATES[0].key);
  });
});
