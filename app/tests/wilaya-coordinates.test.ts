import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Lot 308 — coordonnées des chefs-lieux de wilaya, posées par la migration. Ce test lit la MIGRATION, pas la base : à
// l'étape « tests unitaires » de la CI, la base est vide (les migrations ne sont appliquées qu'ensuite), et un test qui
// interroge `prisma.wilaya` y échouait (« relation Wilaya inexistante »). Les valeurs lues ici sont celles que la
// migration écrira dans la base.
const MIGRATION = join(__dirname, "..", "prisma", "migrations", "20261013100000_wilaya_coordinates_lot_308", "migration.sql");

type Coordinates = { id: number; latitude: number; longitude: number; nom: string };

function readCoordinates(): Coordinates[] {
  const sql = readFileSync(MIGRATION, "utf8");
  const rows: Coordinates[] = [];
  const pattern = /UPDATE "Wilaya" SET "latitude" = (-?\d+(?:\.\d+)?), "longitude" = (-?\d+(?:\.\d+)?) WHERE "id" = (\d+);\s*(?:--\s*(.*))?/g;
  for (const match of sql.matchAll(pattern)) {
    rows.push({ latitude: Number(match[1]), longitude: Number(match[2]), id: Number(match[3]), nom: (match[4] ?? "").trim() });
  }
  return rows;
}

describe("Wilaya coordinates (Lot 308)", () => {
  const rows = readCoordinates();

  it("sets coordinates for at least 58 wilayas, each once", () => {
    expect(rows.length).toBeGreaterThanOrEqual(58);
    const ids = rows.map((row) => row.id);
    expect(new Set(ids).size, "une wilaya est renseignée deux fois").toBe(ids.length);
  });

  it("keeps every coordinate within Algeria's bounding box", () => {
    const outside = rows.filter((row) => row.latitude < 18 || row.latitude > 38 || row.longitude < -9 || row.longitude > 12);
    expect(outside, `hors du territoire : ${outside.map((row) => `${row.id} ${row.nom}`).join(", ")}`).toHaveLength(0);
  });

  it("places Alger approximately at 36.75N 3.04E", () => {
    const alger = rows.find((row) => row.id === 16);
    expect(alger).toBeDefined();
    expect(alger!.latitude).toBeCloseTo(36.75, 1);
    expect(alger!.longitude).toBeCloseTo(3.04, 1);
  });
});
