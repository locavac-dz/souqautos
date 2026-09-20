import { describe, expect, it } from "vitest";
import { SLOW_QUERY_MAX_MS, formatSlowQuery, parseSlowQueryMs } from "@/lib/slow-query";

describe("parseSlowQueryMs — désactivé sauf valeur claire", () => {
  it("lit un nombre entier de millisecondes strictement positif", () => {
    expect(parseSlowQueryMs("200")).toBe(200);
    expect(parseSlowQueryMs(" 50 ")).toBe(50);
    expect(parseSlowQueryMs("1")).toBe(1);
  });
  it("plafonne les valeurs démesurées", () => {
    expect(parseSlowQueryMs("999999999")).toBe(SLOW_QUERY_MAX_MS);
  });
  it("reste désactivé pour tout le reste : absent, vide, zéro, négatif, décimal, texte", () => {
    for (const value of [undefined, "", "  ", "0", "-5", "1.5", "abc", "200ms", "1e3"]) expect(parseSlowQueryMs(value), String(value)).toBeNull();
  });
});

describe("formatSlowQuery", () => {
  it("écrit la durée arrondie et le SQL sur une seule ligne, sans le préfixe de schéma", () => {
    const line = formatSlowQuery('SELECT "public"."Listing"."id"\n  FROM "public"."Listing"\n WHERE "public"."Listing"."status" = $1', 412.7);
    expect(line).toBe('[sql-lent] 413 ms — SELECT "Listing"."id" FROM "Listing" WHERE "Listing"."status" = $1');
    expect(line).not.toContain("\n");
  });
  it("tronque une requête très longue en disant combien a été omis", () => {
    const line = formatSlowQuery(`SELECT ${"colonne, ".repeat(200)}x FROM t`, 100);
    expect(line.length).toBeLessThan(500);
    expect(line).toMatch(/… \(\+\d+ caractères\)$/);
  });
  it("ne contient jamais de valeur de paramètre : le texte SQL n'a que des repères ($1, $2…)", () => {
    // Prisma sépare le texte de la requête (event.query) de ses valeurs (event.params) : seul le texte est formaté ici.
    expect(formatSlowQuery('SELECT * FROM "User" WHERE "email" = $1', 300)).not.toMatch(/@|example/);
  });
});
