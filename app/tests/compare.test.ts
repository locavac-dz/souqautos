import { describe, expect, it } from "vitest";
import { toggleCompareId, MAX_COMPARE } from "@/lib/compare";

describe("toggleCompareId", () => {
  it("adds an id that is not yet selected", () => {
    expect(toggleCompareId([], "a")).toEqual(["a"]);
    expect(toggleCompareId(["a"], "b")).toEqual(["a", "b"]);
  });

  it("removes an id that is already selected", () => {
    expect(toggleCompareId(["a", "b"], "a")).toEqual(["b"]);
  });

  it("does not add a new id once the max is reached", () => {
    const full = ["a", "b", "c", "d"];
    expect(full.length).toBe(MAX_COMPARE);
    expect(toggleCompareId(full, "e")).toEqual(full);
  });

  it("still allows removing an id even when at the max", () => {
    const full = ["a", "b", "c", "d"];
    expect(toggleCompareId(full, "b")).toEqual(["a", "c", "d"]);
  });

  it("respects a custom max for testing purposes", () => {
    expect(toggleCompareId(["a"], "b", 1)).toEqual(["a"]);
  });
});
