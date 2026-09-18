import { describe, expect, it } from "vitest";
import { communes } from "../prisma/commune-data";

describe("commune data", () => {
  it("has exactly 1541 communes (découpage officiel, loi n° 26-06 du 4 avril 2026)", () => {
    expect(communes.length).toBe(1541);
  });

  it("has unique ids", () => {
    const ids = communes.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only references the 69 wilayas (ids 1 à 69)", () => {
    for (const c of communes) {
      expect(c.wilayaId).toBeGreaterThanOrEqual(1);
      expect(c.wilayaId).toBeLessThanOrEqual(69);
    }
  });

  it("covers all 69 wilayas with at least one commune each", () => {
    const wilayaIds = new Set(communes.map((c) => c.wilayaId));
    expect(wilayaIds.size).toBe(69);
  });

  // Effectifs fixés par la loi n° 26-06 (JORADP n° 25 du 5 avril 2026) : art. 52 bis 10 à
  // 52 bis 20 pour les 11 nouvelles wilayas, art. 7 à 36 pour les 10 wilayas-mères réduites.
  it("matches the official commune count of every new wilaya and of its mother wilaya", () => {
    const count = (wilayaId: number) => communes.filter((c) => c.wilayaId === wilayaId).length;
    const official: Record<number, number> = {
      3: 12, // Laghouat
      5: 53, // Batna
      7: 22, // Biskra
      12: 24, // Tébessa
      13: 49, // Tlemcen
      14: 36, // Tiaret
      17: 18, // Djelfa
      26: 43, // Médéa
      28: 24, // M'Sila
      32: 15, // El Bayadh
      59: 12, // Aflou
      60: 8, // Barika
      61: 5, // El Kantara
      62: 4, // Bir El Ater
      63: 4, // El Aricha
      64: 6, // Ksar Chellala
      65: 10, // Aïn Ouessara
      66: 8, // Messaad
      67: 21, // Ksar El Boukhari
      68: 23, // Bou Saâda
      69: 7, // El Abiodh Sidi Cheikh
    };
    for (const [wilayaId, expected] of Object.entries(official)) {
      expect(count(Number(wilayaId)), `wilaya ${wilayaId}`).toBe(expected);
    }
  });

  it("has non-empty French and Arabic names for every commune", () => {
    for (const c of communes) {
      expect(c.nomFr.trim().length).toBeGreaterThan(0);
      expect(c.nomAr.trim().length).toBeGreaterThan(0);
    }
  });
});
