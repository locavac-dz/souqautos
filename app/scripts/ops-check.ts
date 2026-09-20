// Lot 136 — le VEILLEUR : `npm run ops:check [-- options]`
//
//   --out <dossier>    dossier des sauvegardes (défaut : ./backups)
//   --env <fichier>    fichier de configuration (défaut : .env, facultatif)
//   --url <adresse>    adresse du site à contrôler (défaut : NEXT_PUBLIC_SITE_URL) ; --no-health = ne pas le contrôler
//   --notify           envoie un courriel (OPS_ALERT_EMAILS, à défaut STAFF_ALERT_EMAILS) quand il y a un problème
//   --strict           les avertissements comptent aussi (code de sortie, courriel)
//
// Juge, sans rien modifier d'autre que son propre journal : la dernière sauvegarde est-elle récente et réussie, son archive
// est-elle là et de bonne taille, la restauration a-t-elle été testée récemment, reste-t-il de la place, le site répond-il ?
// Code de sortie 0 = tout va bien, 1 = problème (utilisable par un moniteur, cron, un planificateur).
//
// À planifier À PART de la sauvegarde (toutes les heures, modèles dans ops/) : une sauvegarde qui ne tourne plus ne peut
// pas le dire elle-même — c'est ce veilleur qui s'en aperçoit.

import { existsSync, readdirSync, statSync, statfsSync } from "node:fs";
import path from "node:path";
import { resolveOpsRecipients } from "@/lib/alert-recipients";
import { sendEmail } from "@/lib/mailer";
import {
  buildOpsAlertEmail,
  evaluateOps,
  isDumpName,
  problemSignature,
  shouldNotify,
  summarizeOps,
  type BackupFile,
  type HealthFact,
  type OpsStatus,
} from "@/lib/ops-status";
import { readStatus, recordWatchdog } from "./ops-state.mjs";

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const has = (name: string) => process.argv.includes(name);

function loadEnvFile() {
  const resolved = path.resolve(process.cwd(), argValue("--env") ?? ".env");
  if (existsSync(resolved)) process.loadEnvFile(resolved);
  else if (argValue("--env")) {
    console.error(`Fichier de configuration introuvable : ${resolved}`);
    process.exit(2);
  }
}

async function checkHealth(baseUrl: string): Promise<HealthFact> {
  const started = Date.now();
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    return { ok: response.ok, httpStatus: response.status, ms: Date.now() - started };
  } catch (error) {
    if ((error as Error).name === "TimeoutError") return { ok: false, error: "aucune réponse en 5 s" };
    // Node enveloppe l'erreur réseau : « fetch failed », avec la vraie raison (ECONNREFUSED…) dans `cause`, parfois sans message.
    const cause = (error as { cause?: { code?: string; message?: string; errors?: { code?: string }[] } }).cause;
    return { ok: false, error: cause?.code || cause?.errors?.[0]?.code || cause?.message || (error as Error).message || "erreur réseau" };
  }
}

function freeBytes(dir: string): number | null {
  try {
    const stats = statfsSync(dir);
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return null;
  }
}

async function main() {
  loadEnvFile();
  const outDir = path.resolve(process.cwd(), argValue("--out") ?? "backups");
  const strict = has("--strict");

  const dumps: BackupFile[] = existsSync(outDir)
    ? readdirSync(outDir)
        .filter(isDumpName)
        .map((name) => {
          const stats = statSync(path.join(outDir, name));
          return { name, sizeBytes: stats.size, mtimeMs: stats.mtimeMs };
        })
    : [];

  const healthUrl = has("--no-health") ? null : (argValue("--url") ?? process.env.NEXT_PUBLIC_SITE_URL ?? null);
  const status = readStatus(outDir) as OpsStatus | null;
  const checks = evaluateOps({
    now: Date.now(),
    status,
    dumps,
    freeBytes: existsSync(outDir) ? freeBytes(outDir) : null,
    health: healthUrl ? await checkHealth(healthUrl) : null,
  });

  console.log(`Contrôle de l'exploitation — sauvegardes dans ${outDir}${healthUrl ? `, site ${healthUrl}` : ""}\n`);
  const icon = { ok: "✓", warning: "⚠", error: "✗" } as const;
  for (const level of ["error", "warning", "ok"] as const) {
    for (const check of checks.filter((c) => c.level === level)) {
      console.log(`${icon[level]} ${check.message}`);
      if (check.fix) console.log(`    → ${check.fix}`);
    }
  }
  const { errors, warnings, ok } = summarizeOps(checks);
  console.log(`\n${ok} en ordre, ${warnings} point(s) d'attention, ${errors} problème(s).`);

  if (has("--notify")) {
    const signature = problemSignature(checks, strict);
    if (shouldNotify(signature, status?.watchdog, Date.now())) {
      const recipients = resolveOpsRecipients(process.env);
      if (recipients.length === 0) {
        console.log("· --notify : aucun destinataire (OPS_ALERT_EMAILS ou STAFF_ALERT_EMAILS), aucun courriel envoyé.");
      } else {
        const email = buildOpsAlertEmail(checks, strict);
        let sent = 0;
        for (const to of recipients) {
          try {
            const result = await sendEmail({ to, subject: email.subject, html: email.html });
            sent += 1;
            if (result?.previewUrl) console.log(`· aperçu du courriel : ${result.previewUrl}`);
          } catch (error) {
            console.error(`· échec d'envoi à ${to} : ${(error as Error).message}`);
          }
        }
        // Mémorisé seulement si AU MOINS UN courriel est parti : sinon le prochain passage réessaie.
        if (sent > 0) {
          recordWatchdog(outDir, { lastNotifiedAt: new Date().toISOString(), lastSignature: signature });
          console.log(`· courriel envoyé à ${sent} destinataire(s).`);
        }
      }
    } else if (signature) {
      console.log("· problème déjà signalé récemment : pas de nouveau courriel (rappel toutes les 6 h).");
    } else if (status?.watchdog?.lastSignature) {
      // Tout est rentré dans l'ordre : on oublie le dernier signalement, un futur problème sera annoncé tout de suite.
      recordWatchdog(outDir, {});
    }
  }

  process.exit(errors > 0 || (strict && warnings > 0) ? 1 : 0);
}

main().catch((error) => {
  console.error(`Le contrôle n'a pas pu s'exécuter : ${(error as Error).message}`);
  process.exit(2);
});
