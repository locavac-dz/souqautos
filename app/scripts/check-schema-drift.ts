// Contrôle d'écart entre les migrations et schema.prisma — utilisé par la CI.
//
//   SHADOW_DATABASE_URL=… npx tsx scripts/check-schema-drift.ts
//
// Rend 0 s'il n'y a aucun écart, ou seulement les index pg_trgm connus (cf. src/lib/schema-drift.ts) ; 1 sinon.
import { spawnSync } from "node:child_process";
import { unexpectedStatements } from "../src/lib/schema-drift";

const shadow = process.env.SHADOW_DATABASE_URL;
if (!shadow) {
  console.error("SHADOW_DATABASE_URL est requis (base vide servant à rejouer les migrations).");
  process.exit(1);
}

const run = spawnSync(
  "npx",
  ["prisma", "migrate", "diff", "--from-migrations", "prisma/migrations", "--to-schema-datamodel", "prisma/schema.prisma", "--shadow-database-url", shadow, "--script"],
  { encoding: "utf8", shell: process.platform === "win32" },
);

if (run.status !== 0) {
  console.error(`prisma migrate diff a échoué (code ${run.status ?? "?"}) :\n${run.stderr.trim()}`);
  process.exit(1);
}

const unexpected = unexpectedStatements(run.stdout);
if (unexpected.length > 0) {
  console.error("Écart inattendu entre les migrations et schema.prisma (une migration a-t-elle été oubliée ?) :");
  for (const statement of unexpected) console.error(`  ${statement}`);
  process.exit(1);
}

console.log("Aucun écart entre les migrations et schema.prisma (hors index pg_trgm conditionnels connus).");
