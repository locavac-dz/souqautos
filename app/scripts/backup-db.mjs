// Lot 118 — sauvegarde de la base : `npm run db:backup [-- options]`
//
//   --out <dossier>     où écrire les sauvegardes (défaut : ./backups)
//   --keep <jours>      supprimer les sauvegardes plus anciennes (défaut : 14 ; 0 = tout garder)
//   --with-uploads      archiver aussi les fichiers stockés sur le disque : public/uploads (photos) ET private-uploads (pièces
//                       d'identité, chiffrées) — chacun dans SA archive, la seconde étant la plus sensible (Lot 147)
//   --env <fichier>     fichier de configuration (défaut : .env)
//
// Écrit `souq_auto-AAAAMMJJ-HHMMSS.dump` (format « custom » de pg_dump, compressé),
// puis VÉRIFIE que l'archive est lisible (pg_restore --list) : une sauvegarde qu'on
// n'a jamais relue n'est pas une sauvegarde. Ne modifie pas la base.
//
// À planifier (cron, planificateur de tâches) ET à copier HORS du serveur : une
// sauvegarde stockée sur la même machine disparaît avec elle. Voir docs/EXPLOITATION.md.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { argValue, connectionArgs, fail, humanSize, loadEnv, parseDatabaseUrl, runPg, timestamp } from "./pg-helpers.mjs";
import { recordRun } from "./ops-state.mjs";

loadEnv();
const db = parseDatabaseUrl();
const outDir = path.resolve(process.cwd(), argValue("--out", "backups"));
const keepDays = Number(argValue("--keep", "14"));
if (!Number.isFinite(keepDays) || keepDays < 0) fail("--keep attend un nombre de jours (0 ou plus).", 2);

mkdirSync(outDir, { recursive: true });
const stamp = timestamp();
const dumpFile = path.join(outDir, `${db.database}-${stamp}.dump`);

// Sur Windows, Node.js produit des chemins comme C:\dossier que tar (Git Bash) interprète comme un hôte réseau et
// refuse avec « Cannot connect to C: resolve failed ». Cette fonction les convertit au format POSIX attendu par tar
// (/c/dossier) sans toucher aux chemins utilisés ailleurs (existsSync, statSync…).
function toPosix(p) {
  if (process.platform !== "win32") return p;
  return p.replace(/^([A-Za-z]):[/\\]/, (_, d) => `/${d.toLowerCase()}/`).replace(/\\/g, "/");
}

// Un échec est ENREGISTRÉ (status.json) avant de quitter : c'est ce que lit le veilleur (npm run ops:check) pour
// prévenir l'équipe. L'archive incomplète est supprimée : laissée là, elle serait prise pour une vraie sauvegarde par
// la restauration de contrôle et fausserait la comparaison des tailles.
function bail(message, partialFile) {
  if (partialFile && existsSync(partialFile)) unlinkSync(partialFile);
  recordRun(outDir, "backup", "lastFailure", { reason: message.replace(/\s+/g, " ").trim().slice(0, 300) });
  fail(message);
}

console.log(`Sauvegarde de la base « ${db.database} » (${db.host}:${db.port}) → ${dumpFile}`);
const dump = runPg("pg_dump", [...connectionArgs(db), "--format=custom", "--no-owner", "--no-privileges", "--file", dumpFile, db.database], db);
if (dump.status !== 0) {
  bail(`pg_dump a échoué :\n${dump.stderr.trim()}`, dumpFile);
}

// Relecture : la table des matières de l'archive doit être lisible.
const list = runPg("pg_restore", ["--list", dumpFile], db);
if (list.status !== 0) {
  bail(`L'archive écrite n'est PAS lisible (pg_restore --list) :\n${list.stderr.trim()}`, dumpFile);
}
const entries = list.stdout.split("\n").filter((line) => line && !line.startsWith(";")).length;
const size = statSync(dumpFile).size;
const sha256 = createHash("sha256").update(readFileSync(dumpFile)).digest("hex");
console.log(`✓ Archive lisible : ${entries} objets, ${humanSize(size)}, sha256 ${sha256.slice(0, 16)}…`);

let uploadsFile;
let privateUploadsFile;
// Archive un dossier de fichiers dans `<préfixe>-<horodatage>.tar.gz`, à côté de la sauvegarde. Rend le nom de l'archive, ou `undefined`
// si le dossier n'existe pas (stockage S3, ou aucune pièce d'identité envoyée). Un échec est FATAL : « réussi » doit vouloir dire que
// tout ce qui était demandé est écrit.
function archiveFolder(relative, prefix, label) {
  const folder = path.resolve(process.cwd(), relative);
  if (!existsSync(folder)) {
    console.log(`· Aucun dossier ${relative} à archiver.`);
    return undefined;
  }
  const archive = path.join(outDir, `${prefix}-${stamp}.tar.gz`);
  const tar = spawnSync("tar", ["-czf", toPosix(archive), "-C", toPosix(path.dirname(folder)), path.basename(folder)], { encoding: "utf8" });
  if (tar.status !== 0) bail(`L'archivage ${label} a échoué : ${(tar.stderr || tar.error?.message || "").trim()}`, archive);
  console.log(`✓ ${label[0].toUpperCase()}${label.slice(1)} archivées : ${archive} (${humanSize(statSync(archive).size)})`);
  return path.basename(archive);
}
if (process.argv.includes("--with-uploads")) {
  uploadsFile = archiveFolder("public/uploads", "uploads", "photos");
  // Lot 147 — les pièces d'identité des vendeurs (private-uploads/identity, chiffrées avec ENCRYPTION_KEY) vivent sur le disque, hors de
  // la base : sans cette archive, restaurer la base après un sinistre PERDAIT ces documents. Archive à part, car la plus sensible : à
  // protéger comme la base, et à conserver séparément de ENCRYPTION_KEY (sans elle, elles restent illisibles).
  privateUploadsFile = archiveFolder("private-uploads", "private-uploads", "pièces d'identité");
}

if (keepDays > 0) {
  const limit = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const name of readdirSync(outDir)) {
    if (!/^.+-\d{8}-\d{6}\.(dump|tar\.gz)$/.test(name)) continue; // jamais un fichier étranger
    const file = path.join(outDir, name);
    if (statSync(file).mtimeMs < limit) {
      unlinkSync(file);
      removed += 1;
    }
  }
  if (removed > 0) console.log(`· ${removed} sauvegarde(s) de plus de ${keepDays} jours supprimée(s).`);
}

// Réussite enregistrée en DERNIER : « réussi » veut dire que tout ce qui était demandé est écrit et relu.
recordRun(outDir, "backup", "lastSuccess", { file: path.basename(dumpFile), sizeBytes: size, objects: entries, sha256, ...(uploadsFile ? { uploadsFile } : {}), ...(privateUploadsFile ? { privateUploadsFile } : {}) });
console.log("Terminé. N'oubliez pas de copier ces fichiers hors du serveur.");
