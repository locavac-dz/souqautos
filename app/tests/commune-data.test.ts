import { describe, expect, it } from "vitest";
import { communes } from "../prisma/commune-data";

describe("commune data", () => {
  it("has exactly 1541 communes (découpage officiel du Ministère de l'Intérieur)", () => {
    expect(communes.length).toBe(1541);
  });

  it("has unique ids", () => {
    const ids = communes.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only references the 58 wilayas (ids 1 à 58)", () => {
    for (const c of communes) {
      expect(c.wilayaId).toBeGreaterThanOrEqual(1);
      expect(c.wilayaId).toBeLessThanOrEqual(58);
    }
  });

  it("covers all 58 wilayas with at least one commune each", () => {
    const wilayaIds = new Set(communes.map((c) => c.wilayaId));
    expect(wilayaIds.size).toBe(58);
  });

  it("has non-empty French and Arabic names for every commune", () => {
    for (const c of communes) {
      expect(c.nomFr.trim().length).toBeGreaterThan(0);
      expect(c.nomAr.trim().length).toBeGreaterThan(0);
    }
  });
});
