import { describe, expect, it } from "vitest";
import { MAG_TOPIC_TEMPLATES, pickNextTopic } from "@/lib/editorial-topics";

describe("MAG_TOPIC_TEMPLATES", () => {
  it("has at least 10 topics", () => {
    expect(MAG_TOPIC_TEMPLATES.length).toBeGreaterThanOrEqual(10);
  });

  it("each topic has a non-empty key and prompt", () => {
    for (const t of MAG_TOPIC_TEMPLATES) {
      expect(t.key.length).toBeGreaterThan(0);
      expect(t.promptFr.length).toBeGreaterThan(20);
    }
  });

  it("keys are unique", () => {
    const keys = MAG_TOPIC_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("pickNextTopic", () => {
  it("returns the first topic when no recent keys", () => {
    const topic = pickNextTopic([]);
    expect(topic.key).toBe(MAG_TOPIC_TEMPLATES[0].key);
  });

  it("skips recent keys and returns the next unused topic", () => {
    const recent = MAG_TOPIC_TEMPLATES.slice(0, 3).map((t) => t.key);
    const topic = pickNextTopic(recent);
    expect(topic.key).toBe(MAG_TOPIC_TEMPLATES[3].key);
  });

  it("wraps around to the first topic when all keys are recent", () => {
    const allKeys = MAG_TOPIC_TEMPLATES.map((t) => t.key);
    const topic = pickNextTopic(allKeys);
    expect(topic.key).toBe(MAG_TOPIC_TEMPLATES[0].key);
  });

  it("handles partial overlap correctly", () => {
    const recent = [MAG_TOPIC_TEMPLATES[0].key, MAG_TOPIC_TEMPLATES[2].key];
    const topic = pickNextTopic(recent);
    expect(topic.key).toBe(MAG_TOPIC_TEMPLATES[1].key);
  });
});
