import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

describe("Wilaya coordinates (Lot 308)", () => {
  it("every wilaya has latitude and longitude set", async () => {
    const wilayas = await prisma.wilaya.findMany({
      select: { id: true, nomFr: true, latitude: true, longitude: true },
    });
    expect(wilayas.length).toBeGreaterThanOrEqual(58);

    const missing = wilayas.filter((w) => w.latitude === null || w.longitude === null);
    expect(missing, `wilayas sans coordonnées : ${missing.map((w) => w.nomFr).join(", ")}`).toHaveLength(0);
  });

  it("coordinates are within Algeria's bounding box", async () => {
    const wilayas = await prisma.wilaya.findMany({
      select: { id: true, nomFr: true, latitude: true, longitude: true },
    });

    for (const w of wilayas) {
      expect(w.latitude).not.toBeNull();
      expect(w.longitude).not.toBeNull();
      expect(w.latitude!).toBeGreaterThanOrEqual(18);
      expect(w.latitude!).toBeLessThanOrEqual(38);
      expect(w.longitude!).toBeGreaterThanOrEqual(-9);
      expect(w.longitude!).toBeLessThanOrEqual(12);
    }
  });

  it("Alger is approximately at 36.75N 3.04E", async () => {
    const alger = await prisma.wilaya.findUnique({ where: { id: 16 } });
    expect(alger).not.toBeNull();
    expect(alger!.latitude).toBeCloseTo(36.75, 1);
    expect(alger!.longitude).toBeCloseTo(3.04, 1);
  });
});
