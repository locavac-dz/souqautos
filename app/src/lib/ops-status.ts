// Lot 136 — supervision des sauvegardes : juge, à partir de FAITS lus sur le disque (journal d'état écrit par
// scripts/backup-db.mjs et scripts/restore-check.mjs, liste des archives, place libre, réponse du site), si tout va bien.
//
// Pourquoi un veilleur À PART : une sauvegarde planifiée qui cesse de tourner (tâche supprimée, disque plein, mot de
// passe changé) ne prévient personne — c'est justement le cas où elle ne peut pas le faire elle-même. On ne s'en aperçoit
// alors qu'au jour du sinistre. Ce module ne lit rien, n'écrit rien : scripts/ops-check.ts fournit les faits.

export type OpsLevel = "ok" | "warning" | "error";
export type OpsCheck = { id: string; level: OpsLevel; message: string; fix?: string };

export type RunRecord = {
  at: string; // date ISO
  file?: string;
  sizeBytes?: number;
  objects?: number;
  sha256?: string;
  uploadsFile?: string;
  // Lot 147 — l'archive des pièces d'identité (private-uploads), à part de celle des photos.
  privateUploadsFile?: string;
  tables?: number;
  reason?: string; // seulement pour un échec
};
export type OpsStatus = {
  backup?: { lastSuccess?: RunRecord; lastFailure?: RunRecord };
  restoreCheck?: { lastSuccess?: RunRecord; lastFailure?: RunRecord };
  watchdog?: { lastNotifiedAt?: string; lastSignature?: string };
};

export type BackupFile = { name: string; sizeBytes: number; mtimeMs: number };
export type HealthFact = { ok: boolean; httpStatus?: number; ms?: number; error?: string };

export type OpsFacts = {
  now: number;
  status: OpsStatus | null; // null : aucun journal (jamais de sauvegarde, ou mauvais dossier)
  dumps: BackupFile[]; // archives de base présentes, tout ordre
  freeBytes: number | null; // place libre dans le dossier des sauvegardes ; null = inconnue
  health: HealthFact | null; // null : contrôle non demandé
};

export type OpsThresholds = {
  backupMaxAgeHours: number; // sauvegarde de nuit : 26 h = une nuit manquée est signalée le lendemain
  restoreMaxAgeDays: number; // test de restauration mensuel
  sizeDropRatio: number; // dernière archive < ratio × médiane des précédentes = suspecte
  healthSlowMs: number;
};
export const DEFAULT_THRESHOLDS: OpsThresholds = { backupMaxAgeHours: 26, restoreMaxAgeDays: 35, sizeDropRatio: 0.5, healthSlowMs: 3000 };

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const DUMP_NAME = /^.+-\d{8}-\d{6}\.dump$/;

export function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
  return `${(bytes / 1024 ** 3).toFixed(1)} Go`;
}

function ageText(ms: number): string {
  if (ms < 2 * HOUR) return `${Math.max(0, Math.round(ms / 60000))} min`;
  if (ms < 2 * DAY) return `${Math.round(ms / HOUR)} h`;
  return `${Math.round(ms / DAY)} jours`;
}

const time = (record?: RunRecord) => (record ? Date.parse(record.at) : NaN);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function checkBackup(facts: OpsFacts, t: OpsThresholds): OpsCheck[] {
  const backup = facts.status?.backup;
  const success = backup?.lastSuccess;
  const failure = backup?.lastFailure;
  const results: OpsCheck[] = [];

  if (!success) {
    results.push({
      id: "backup-recent",
      level: "error",
      message: failure ? `Aucune sauvegarde n'a JAMAIS réussi (dernier échec : ${failure.reason ?? "raison inconnue"}).` : "Aucune sauvegarde enregistrée : elle n'a jamais tourné, ou ce n'est pas le bon dossier.",
      fix: "Lancer : npm run db:backup — puis la planifier chaque nuit (docs/EXPLOITATION.md, section 2 ; modèles dans ops/).",
    });
    return results;
  }

  const age = facts.now - time(success);
  const failedSince = failure && time(failure) > time(success);
  if (failedSince) {
    results.push({ id: "backup-recent", level: "error", message: `La dernière sauvegarde a ÉCHOUÉ (${failure.reason ?? "raison inconnue"}) ; la dernière réussie date de ${ageText(age)}.`, fix: "Lire le message ci-dessus, corriger, puis relancer npm run db:backup." });
  } else if (age > t.backupMaxAgeHours * HOUR) {
    results.push({ id: "backup-recent", level: "error", message: `La dernière sauvegarde réussie date de ${ageText(age)} (limite : ${t.backupMaxAgeHours} h) : la planification ne tourne plus.`, fix: "Vérifier la tâche planifiée (cron, planificateur de tâches) et ses journaux." });
  } else {
    results.push({ id: "backup-recent", level: "ok", message: `Dernière sauvegarde réussie il y a ${ageText(age)}.` });
  }

  // Le fichier promis par le journal existe-t-il encore ? (effacé à la main, disque remplacé, mauvais dossier)
  const dumps = facts.dumps.filter((d) => DUMP_NAME.test(d.name));
  const latestFile = success.file ? dumps.find((d) => d.name === success.file) : undefined;
  if (success.file && !latestFile) {
    results.push({ id: "backup-file", level: "error", message: `L'archive de la dernière sauvegarde (${success.file}) est introuvable dans le dossier.`, fix: "Elle a été supprimée ou déplacée : refaire une sauvegarde et vérifier ce qui efface le dossier." });
  } else if (latestFile) {
    if (latestFile.sizeBytes < 1024) {
      results.push({ id: "backup-size", level: "error", message: `La dernière archive ne pèse que ${humanBytes(latestFile.sizeBytes)} : elle est vide ou tronquée.` });
    } else {
      const previous = dumps.filter((d) => d.name !== latestFile.name).sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 7);
      if (previous.length >= 3 && latestFile.sizeBytes < t.sizeDropRatio * median(previous.map((d) => d.sizeBytes))) {
        results.push({ id: "backup-size", level: "warning", message: `La dernière archive (${humanBytes(latestFile.sizeBytes)}) pèse moins de la moitié de la médiane des ${previous.length} précédentes (${humanBytes(median(previous.map((d) => d.sizeBytes)))}) : perte de données possible.`, fix: "Comparer avec npm run db:restore-check ; vérifier qu'aucune table n'a été vidée." });
      } else {
        results.push({ id: "backup-size", level: "ok", message: `Archive de ${humanBytes(latestFile.sizeBytes)}, cohérente avec les précédentes.` });
      }
    }
  }
  return results;
}

function checkRestore(facts: OpsFacts, t: OpsThresholds): OpsCheck {
  const restore = facts.status?.restoreCheck;
  const success = restore?.lastSuccess;
  const failure = restore?.lastFailure;
  const fix = "Lancer : npm run db:restore-check (le rôle doit avoir CREATEDB), et le planifier chaque mois.";
  if (failure && (!success || time(failure) > time(success))) {
    return { id: "restore-check", level: "error", message: `Le dernier test de restauration a ÉCHOUÉ (${failure.reason ?? "raison inconnue"}) : ne pas se fier aux sauvegardes.`, fix };
  }
  if (!success) return { id: "restore-check", level: "warning", message: "Aucun test de restauration enregistré : on ne sait pas si les sauvegardes sont utilisables.", fix };
  const age = facts.now - time(success);
  if (age > t.restoreMaxAgeDays * DAY) return { id: "restore-check", level: "warning", message: `Le dernier test de restauration réussi date de ${ageText(age)} (limite : ${t.restoreMaxAgeDays} jours).`, fix };
  return { id: "restore-check", level: "ok", message: `Restauration vérifiée il y a ${ageText(age)}.` };
}

function checkDisk(facts: OpsFacts): OpsCheck | null {
  if (facts.freeBytes === null) return null;
  const latest = Math.max(0, ...facts.dumps.map((d) => d.sizeBytes));
  const fix = "Libérer de la place, réduire la durée de conservation (--keep) ou déplacer les sauvegardes sur un autre volume.";
  if (facts.freeBytes < latest * 1.2 + 50 * 1024 * 1024) return { id: "backup-disk", level: "error", message: `Il reste ${humanBytes(facts.freeBytes)} de libre : la prochaine sauvegarde (${humanBytes(latest)}) risque d'échouer.`, fix };
  if (facts.freeBytes < latest * 5) return { id: "backup-disk", level: "warning", message: `Il reste ${humanBytes(facts.freeBytes)} de libre, moins de 5 sauvegardes.`, fix };
  return { id: "backup-disk", level: "ok", message: `${humanBytes(facts.freeBytes)} de libre pour les sauvegardes.` };
}

function checkHealth(facts: OpsFacts, t: OpsThresholds): OpsCheck | null {
  const health = facts.health;
  if (!health) return null;
  if (!health.ok) {
    return { id: "site-health", level: "error", message: `Le site ne répond pas correctement (${health.httpStatus ? `HTTP ${health.httpStatus}` : (health.error ?? "aucune réponse")}).`, fix: "Voir les journaux du serveur ; GET /api/health indique si c'est la base de données." };
  }
  if ((health.ms ?? 0) > t.healthSlowMs) return { id: "site-health", level: "warning", message: `Le site répond, mais lentement (${health.ms} ms pour un simple contrôle).` };
  return { id: "site-health", level: "ok", message: `Le site répond (${health.ms ?? "?"} ms).` };
}

export function evaluateOps(facts: OpsFacts, thresholds: OpsThresholds = DEFAULT_THRESHOLDS): OpsCheck[] {
  return [...checkBackup(facts, thresholds), checkRestore(facts, thresholds), checkDisk(facts), checkHealth(facts, thresholds)].filter((c): c is OpsCheck => c !== null);
}

export function summarizeOps(checks: OpsCheck[]): { errors: number; warnings: number; ok: number } {
  const errors = checks.filter((c) => c.level === "error").length;
  const warnings = checks.filter((c) => c.level === "warning").length;
  return { errors, warnings, ok: checks.length - errors - warnings };
}

// Empreinte des problèmes en cours : le même ensemble ne redéclenche pas un courriel à chaque passage du veilleur.
export function problemSignature(checks: OpsCheck[], includeWarnings: boolean): string {
  return checks
    .filter((c) => c.level === "error" || (includeWarnings && c.level === "warning"))
    .map((c) => `${c.id}:${c.level}`)
    .sort()
    .join("|");
}

export const NOTIFY_COOLDOWN_MS = 6 * HOUR;

// Prévenir si des problèmes existent ET (ce sont de nouveaux problèmes OU le dernier courriel date de plus de 6 h : un
// problème qui dure est rappelé, sans harceler). Aucun problème : rien à dire.
export function shouldNotify(signature: string, watchdog: OpsStatus["watchdog"], now: number): boolean {
  if (!signature) return false;
  if (watchdog?.lastSignature !== signature) return true;
  const last = watchdog?.lastNotifiedAt ? Date.parse(watchdog.lastNotifiedAt) : NaN;
  return !Number.isFinite(last) || now - last >= NOTIFY_COOLDOWN_MS;
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildOpsAlertEmail(checks: OpsCheck[], includeWarnings: boolean): { subject: string; html: string } {
  const problems = checks.filter((c) => c.level === "error" || (includeWarnings && c.level === "warning"));
  const errors = problems.filter((c) => c.level === "error").length;
  const subject = `[Souq Auto] ${errors > 0 ? "PROBLÈME" : "Attention"} : sauvegardes et supervision — ${problems.length} point${problems.length > 1 ? "s" : ""}`;
  const items = problems
    .map((c) => `<li><strong>${c.level === "error" ? "✗" : "⚠"}</strong> ${escapeHtml(c.message)}${c.fix ? `<br><span style="color:#475569">→ ${escapeHtml(c.fix)}</span>` : ""}</li>`)
    .join("");
  const html =
    `<p>Bonjour,</p><p>Le contrôle automatique de l'exploitation a relevé :</p><ul>${items}</ul>` +
    `<p style="color:#64748b;font-size:12px">Ce message est renvoyé au plus toutes les 6 heures tant que le problème dure, et dès qu'un nouveau problème apparaît.</p>`;
  return { subject, html };
}

// Un archive de base : « <base>-AAAAMMJJ-HHMMSS.dump » (mêmes noms que scripts/backup-db.mjs).
export const isDumpName = (name: string) => DUMP_NAME.test(name);
