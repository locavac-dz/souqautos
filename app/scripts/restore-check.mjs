// Lot 118 — test de restauration : `npm run db:restore-check [-- options]`
//
//   --file <archive>    sauvegarde à tester (défaut : la plus récente de ./backups)
//   --out <dossier>     dossier des sauvegardes (défaut : ./backups)
//   --env <fichier>     fichier de configuration (défaut : .env)
//
// Restaure la sauvegarde dans une base TEMPORAIRE `<base>_restorecheck`, compare le
// nombre de lignes des tables clés avec la base réelle, puis supprime la base
// temporaire. Ne touche JAMAIS à la base réelle. Le rôle de connexion doit pouvoir
// créer une base (CREATEDB) : en production, utiliser un rôle de maintenance
// (`--env` vers un fichier dont DATABASE_URL utilise ce rôle).
//
// C'est LA vérification qui compte : c'est en restaurant qu'on sait que la
// sauvegarde sert à quelque chose.

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { argValue, connectionArgs, fail, loadEnv, parseDatabaseUrl, runPg } from "./pg-helpers.mjs";
import { recordRun } from "./ops-state.mjs";

loadEnv();
const db = parseDatabaseUrl();
const outDir = path.resolve(process.cwd(), argValue("--out", "backups"));

function latestBackup() {
  if (!existsSync(outDir)) fail(`Aucun dossier de sauvegardes : ${outDir}. Lancer d'abord : npm run db:backup`, 2);
  const files = readdirSync(outDir)
    .filter((name) => name.startsWith(`${db.database}-`) && name.endsWith(".dump"))
    .map((name) => ({ name, mtime: statSync(path.join(outDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length === 0) fail(`Aucune sauvegarde de « ${db.database} » dans ${outDir}. Lancer d'abord : npm run db:backup`, 2);
  return path.join(outDir, files[0].name);
}

const dumpFile = path.resolve(process.cwd(), argValue("--file", "") || latestBackup());
if (!existsSync(dumpFile)) fail(`Sauvegarde introuvable : ${dumpFile}`, 2);

const scratch = `${db.database}_restorecheck`;
if (scratch === db.database || !scratch.endsWith("_restorecheck")) fail("Nom de base temporaire invalide.", 2);

// Tables clés : ce qui ferait mal à perdre.
const TABLES = ["User", "Profile", "Listing", "ListingPhoto", "Conversation", "Message", "Review", "OwnerReview", "BlogArticle", "PressReview", "AuditLog", "Brand", "Model", "Wilaya", "Commune"];

function count(database, table) {
  const result = runPg("psql", [...connectionArgs(db), "-d", database, "-tA", "-c", `SELECT count(*) FROM "${table}"`], db);
  if (result.status !== 0) return null;
  return Number(result.stdout.trim());
}

console.log(`Test de restauration de ${path.basename(dumpFile)} dans la base temporaire « ${scratch} »`);
let exitCode = 0;
let failureReason = "";
const problemTables = [];
try {
  runPg("dropdb", [...connectionArgs(db), "--if-exists", scratch], db);
  const created = runPg("createdb", [...connectionArgs(db), scratch], db);
  if (created.status !== 0) {
    recordRun(outDir, "restoreCheck", "lastFailure", { file: path.basename(dumpFile), reason: "impossible de créer la base temporaire (rôle sans CREATEDB ?)" });
    fail(`Impossible de créer la base temporaire (le rôle « ${db.user} » a-t-il CREATEDB ?) :\n${created.stderr.trim()}`);
  }

  const restore = runPg("pg_restore", [...connectionArgs(db), "--no-owner", "--no-privileges", "--exit-on-error", "-d", scratch, dumpFile], db);
  if (restore.status !== 0) {
    console.error(`✗ La restauration a ÉCHOUÉ :\n${restore.stderr.trim()}`);
    exitCode = 1;
    failureReason = `pg_restore a échoué : ${restore.stderr.replace(/\s+/g, " ").trim().slice(0, 250)}`;
  } else {
    console.log("✓ Restauration terminée sans erreur.\n");
    console.log("Table".padEnd(18) + "base réelle".padStart(13) + "restaurée".padStart(13));
    for (const table of TABLES) {
      const source = count(db.database, table);
      const restored = count(scratch, table);
      const problem = restored === null || (source !== null && source > 0 && restored === 0);
      const changed = !problem && source !== null && restored !== source;
      if (problem) {
        exitCode = 1;
        problemTables.push(table);
      }
      console.log(`${table.padEnd(18)}${String(source ?? "?").padStart(13)}${String(restored ?? "absente").padStart(13)}  ${problem ? "✗" : changed ? "≠" : "✓"}`);
    }
    console.log("\n✓ = identique · ≠ = la base a changé depuis la sauvegarde (normal si elle est en service) · ✗ = table absente ou vide alors que la base réelle a des lignes");
  }
} finally {
  const dropped = runPg("dropdb", [...connectionArgs(db), "--if-exists", scratch], db);
  console.log(dropped.status === 0 ? `\nBase temporaire « ${scratch} » supprimée.` : `\n⚠ Base temporaire « ${scratch} » à supprimer à la main : ${dropped.stderr.trim()}`);
}

// Enregistré pour le veilleur (npm run ops:check) : c'est LA preuve que la sauvegarde sert à quelque chose.
if (exitCode === 0) recordRun(outDir, "restoreCheck", "lastSuccess", { file: path.basename(dumpFile), tables: TABLES.length });
else recordRun(outDir, "restoreCheck", "lastFailure", { file: path.basename(dumpFile), reason: failureReason || `tables absentes ou vides : ${problemTables.join(", ")}` });

console.log(exitCode === 0 ? "\nRESTAURATION VÉRIFIÉE." : "\nRESTAURATION NON CONFORME : ne pas se fier à cette sauvegarde.");
process.exit(exitCode);
