import { describe, expect, it } from "vitest";
import { unexpectedStatements } from "@/lib/schema-drift";

const TRGM_DROPS = [
  "-- DropIndex",
  'DROP INDEX "Listing_title_trgm_idx";',
  "",
  "-- DropIndex",
  'DROP INDEX "Listing_brandFreeText_trgm_idx";',
  "",
  "-- DropIndex",
  'DROP INDEX "Listing_modelFreeText_trgm_idx";',
].join("\n");

describe("contrôle d'écart migrations / schema.prisma", () => {
  it("n'ignore rien quand il n'y a aucun écart", () => {
    expect(unexpectedStatements("")).toEqual([]);
    expect(unexpectedStatements("-- This is an empty migration.\n")).toEqual([]);
  });

  it("tolère les trois index GIN pg_trgm créés en SQL brut", () => {
    expect(unexpectedStatements(TRGM_DROPS)).toEqual([]);
  });

  it("tolère les mêmes index quand Prisma préfixe le schéma ou ajoute IF EXISTS", () => {
    expect(unexpectedStatements('DROP INDEX "public"."Listing_title_trgm_idx";')).toEqual([]);
    expect(unexpectedStatements('DROP INDEX IF EXISTS "Listing_modelFreeText_trgm_idx";')).toEqual([]);
  });

  it("ignore les avertissements du CLI Prisma mêlés à la sortie", () => {
    const sortie = [
      "warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7.",
      "For more information, see: https://pris.ly/prisma-config",
      TRGM_DROPS,
    ].join("\n");
    expect(unexpectedStatements(sortie)).toEqual([]);
  });

  it("signale une migration oubliée (colonne ajoutée au schéma sans migration)", () => {
    const sql = `${TRGM_DROPS}\n\n-- AlterTable\nALTER TABLE "Listing" ADD COLUMN "exemple" TEXT;`;
    expect(unexpectedStatements(sql)).toEqual(['ALTER TABLE "Listing" ADD COLUMN "exemple" TEXT;']);
  });

  it("ne tolère pas un autre index, même de nom voisin", () => {
    expect(unexpectedStatements('DROP INDEX "Listing_title_idx";')).toEqual(['DROP INDEX "Listing_title_idx";']);
    expect(unexpectedStatements('DROP INDEX "Listing_description_trgm_idx";')).toHaveLength(1);
    expect(unexpectedStatements('DROP INDEX "Message_title_trgm_idx";')).toHaveLength(1);
  });

  it("ne tolère pas un DROP TABLE ni un DROP INDEX multiple", () => {
    expect(unexpectedStatements('DROP TABLE "Listing";')).toHaveLength(1);
    expect(unexpectedStatements('DROP INDEX "Listing_title_trgm_idx", "Listing_title_idx";')).toHaveLength(1);
  });
});
