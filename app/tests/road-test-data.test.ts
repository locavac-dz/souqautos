import { describe, expect, it } from "vitest";
import { toRoadTestData } from "@/lib/road-test-data";
import type { RoadTestInput } from "@/lib/validation/blog";

const input: RoadTestInput = {
  rating: 4,
  prosFr: "  Confort \n\n Prix ",
  prosAr: "راحة\nسعر",
  consFr: "Coffre",
  consAr: "صندوق",
  verdictFr: "Une compacte confortable et bien équipée.",
  verdictAr: "سيارة مريحة ومجهزة جيدا للغاية.",
};

describe("toRoadTestData", () => {
  it("normalizes the pros/cons lists to one trimmed item per line", () => {
    expect(toRoadTestData(input).prosFr).toBe("Confort\nPrix");
  });

  it("stores absent optional fields as null", () => {
    expect(toRoadTestData(input)).toMatchObject({
      brandId: null,
      modelId: null,
      generationId: null,
      testedVersion: null,
      testedAt: null,
    });
  });

  it("derives the brand from the model when only the model was chosen", () => {
    expect(toRoadTestData({ ...input, modelId: 12 }, 3)).toMatchObject({ brandId: 3, modelId: 12 });
  });

  it("keeps an explicit brand over the derived one", () => {
    expect(toRoadTestData({ ...input, brandId: 5, modelId: 12 }, 3).brandId).toBe(5);
  });

  it("stores the test date as midnight UTC", () => {
    expect(toRoadTestData({ ...input, testedAt: "2026-09-01" }).testedAt).toEqual(new Date("2026-09-01T00:00:00Z"));
  });
});
