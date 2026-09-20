// Lot 136 — journal d'état des sauvegardes : `<dossier des sauvegardes>/status.json`.
//
// Écrit par db:backup et db:restore-check (réussite OU échec), lu par ops:check (le veilleur) : c'est ce qui permet de
// savoir, sans rien relancer, quand la dernière sauvegarde a réussi et si le dernier test de restauration a abouti.
// Aucune donnée personnelle, aucun secret : des dates, des noms de fichiers, des tailles, un message d'erreur.

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const STATUS_FILE = "status.json";

export function statusPath(outDir) {
  return path.join(outDir, STATUS_FILE);
}

export function readStatus(outDir) {
  const file = statusPath(outDir);
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null; // journal abîmé : traité comme absent, il sera réécrit à la prochaine sauvegarde
  }
}

// Écriture par fichier temporaire puis renommage : le veilleur ne lit jamais un journal à moitié écrit.
function writeStatus(outDir, status) {
  const file = statusPath(outDir);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(status, null, 2));
  renameSync(tmp, file);
}

// section : "backup" | "restoreCheck" ; kind : "lastSuccess" | "lastFailure".
export function recordRun(outDir, section, kind, record) {
  const status = readStatus(outDir) ?? {};
  status[section] = { ...(status[section] ?? {}), [kind]: { at: new Date().toISOString(), ...record } };
  writeStatus(outDir, status);
}

// Ce que le veilleur a déjà signalé (pour ne pas renvoyer le même courriel à chaque passage).
export function recordWatchdog(outDir, watchdog) {
  writeStatus(outDir, { ...(readStatus(outDir) ?? {}), watchdog });
}
