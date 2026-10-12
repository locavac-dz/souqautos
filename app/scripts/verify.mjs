// Lot 129 — `npm run verify` : les mêmes contrôles que la chaîne d'intégration (.github/workflows/ci.yml),
// lancés sur ce poste, avec un résumé chronométré. S'arrête à la première erreur (sortie 1).
//
//   npm run verify                  types, lint, tests unitaires (dont cohérence FR/AR), écart schéma/migrations
//   npm run verify -- --e2e         + tests de bout en bout et application installable (plusieurs minutes ;
//                                     arrêter le serveur de développement avant : un seul `next dev` par dossier)
//   npm run verify -- --keep-going  continue après une erreur et les résume toutes à la fin
//
// L'étape « écart schéma/migrations » demande une base VIDE dont l'adresse est dans SHADOW_DATABASE_URL
// (Prisma y rejoue les migrations pour les comparer au schéma). Sans elle, l'étape est ignorée et signalée.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const args = new Set(process.argv.slice(2));
const withE2e = args.has("--e2e");
const keepGoing = args.has("--keep-going");

// SHADOW_DATABASE_URL peut figurer dans .env ; on n'y lit QUE cette valeur (jamais affichée). Charger tout
// .env dans l'environnement fausserait les tests unitaires, qui supposent l'absence de Redis, comme en CI.
const shadowUrl = process.env.SHADOW_DATABASE_URL || (existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")).SHADOW_DATABASE_URL : undefined);

const steps = [
  { name: "Types", cmd: "npx tsc --noEmit" },
  { name: "Lint", cmd: "npm run lint" },
  { name: "Tests unitaires et cohérence des textes FR/AR", cmd: "npm test" },
  shadowUrl
    ? { name: "Écart schéma / migrations", cmd: "npx tsx scripts/check-schema-drift.ts", env: { SHADOW_DATABASE_URL: shadowUrl } }
    : { name: "Écart schéma / migrations", skip: "SHADOW_DATABASE_URL non définie (base vide nécessaire)" },
  ...(withE2e
    ? [
        { name: "Tests de bout en bout", cmd: "npm run test:e2e" },
        { name: "Application installable (production)", cmd: "npm run test:e2e:pwa" },
      ]
    : [{ name: "Tests de bout en bout", skip: "ajouter --e2e pour les lancer" }]),
];

const results = [];
for (const step of steps) {
  if (step.skip) {
    console.log(`\n— ${step.name} : ignoré (${step.skip})`);
    results.push({ name: step.name, status: "ignoré", seconds: 0, note: step.skip });
    continue;
  }
  console.log(`\n▶ ${step.name}`);
  const started = Date.now();
  const run = spawnSync(step.cmd, { stdio: "inherit", shell: true, env: { ...process.env, ...(step.env ?? {}) } });
  const seconds = Math.round((Date.now() - started) / 100) / 10;
  const ok = run.status === 0;
  results.push({ name: step.name, status: ok ? "ok" : "ÉCHEC", seconds });
  if (!ok && !keepGoing) break;
}

console.log("\n──────── Résumé ────────");
for (const r of results) console.log(`${r.status === "ok" ? "✓" : r.status === "ignoré" ? "—" : "✗"} ${r.name.padEnd(48)} ${r.status.padEnd(7)} ${r.seconds ? r.seconds + " s" : ""}`);
const failed = results.filter((r) => r.status === "ÉCHEC");
const skipped = results.filter((r) => r.status === "ignoré");
console.log(failed.length ? `\n${failed.length} étape(s) en échec.` : skipped.length ? `\nTout ce qui a été lancé est en ordre (${skipped.length} étape(s) ignorée(s)).` : "\nTout est en ordre.");
process.exit(failed.length ? 1 : 0);
