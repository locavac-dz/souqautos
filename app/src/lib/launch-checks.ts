import { resolveMailConfig, DEFAULT_MAIL_FROM } from "@/lib/mail-config";
import { parseTrustedProxyHops } from "@/lib/client-ip";
import { resolvePushConfig, vapidKeysMatch } from "@/lib/push";

// Lot 117 — contrôle de préparation à la mise en ligne (`npm run launch:check`).
//
// Juge la configuration telle qu'elle sera EN PRODUCTION, quel que soit
// l'environnement où la commande est lancée. Logique pure (testée sans base) ;
// le script `scripts/launch-check.ts` rassemble les faits qui exigent la base.

export type CheckLevel = "ok" | "warning" | "error";

export type CheckResult = {
  id: string;
  level: CheckLevel;
  message: string;
  // Que faire quand ce n'est pas « ok ».
  fix?: string;
};

// Faits collectés en base par le script.
export type LaunchFacts = {
  dbReachable: boolean;
  // Le compte admin@souqauto.dz existe ET son mot de passe est celui du README.
  adminUsesDevPassword: boolean;
  // Comptes dont l'adresse se termine par un domaine de démonstration.
  demoAccounts: number;
  // Migrations présentes dans prisma/migrations / effectivement appliquées.
  migrationsOnDisk: number;
  migrationsApplied: number;
};

type Env = Record<string, string | undefined>;

const PLACEHOLDERS = ["change-me", "changeme", "change-me-in-production", "secret", "password"];

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const lower = value.trim().toLowerCase();
  return PLACEHOLDERS.some((p) => lower === p);
}

function isLocalHost(hostname: string): boolean {
  return /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|::1)$/.test(hostname) || hostname.endsWith(".local");
}

function checkSecrets(env: Env): CheckResult[] {
  const results: CheckResult[] = [];

  const jwt = env.JWT_SECRET;
  if (isPlaceholder(jwt)) {
    results.push({ id: "jwt", level: "error", message: "JWT_SECRET absent ou resté à sa valeur d'exemple : les sessions seraient falsifiables.", fix: "Générer : openssl rand -base64 48" });
  } else if ((jwt ?? "").length < 32) {
    results.push({ id: "jwt", level: "error", message: "JWT_SECRET fait moins de 32 caractères.", fix: "Générer : openssl rand -base64 48" });
  } else {
    results.push({ id: "jwt", level: "ok", message: "JWT_SECRET défini et de longueur suffisante." });
  }

  const key = env.ENCRYPTION_KEY;
  if (isPlaceholder(key)) {
    results.push({ id: "encryption", level: "error", message: "ENCRYPTION_KEY absente ou restée à sa valeur d'exemple : téléphones et pièces d'identité seraient mal protégés.", fix: "Générer : node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"" });
  } else if (Buffer.from(key ?? "", "base64").length !== 32) {
    results.push({ id: "encryption", level: "error", message: "ENCRYPTION_KEY n'est pas une clé de 32 octets encodée en base64.", fix: "Générer : node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"" });
  } else {
    results.push({ id: "encryption", level: "ok", message: "ENCRYPTION_KEY valide (32 octets)." });
  }

  return results;
}

function checkDatabase(env: Env): CheckResult[] {
  const url = env.DATABASE_URL;
  if (!url) {
    return [{ id: "database-url", level: "error", message: "DATABASE_URL n'est pas défini.", fix: "Voir .env.example." }];
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return [{ id: "database-url", level: "error", message: "DATABASE_URL n'est pas une adresse valide." }];
  }
  const results: CheckResult[] = [];
  if (isPlaceholder(decodeURIComponent(parsed.password))) {
    results.push({ id: "database-password", level: "error", message: "Le mot de passe de la base est celui de l'exemple (« change-me »).", fix: "Créer un rôle dédié avec un mot de passe fort." });
  } else {
    results.push({ id: "database-password", level: "ok", message: "Mot de passe de base personnalisé." });
  }
  if (isLocalHost(parsed.hostname)) {
    results.push({ id: "database-host", level: "warning", message: "La base est sur la machine locale : à confirmer si le serveur applicatif est le même.", fix: "Sinon, pointer vers le serveur PostgreSQL de production." });
  }
  return results;
}

function checkSiteUrl(env: Env): CheckResult {
  const raw = env.NEXT_PUBLIC_SITE_URL;
  if (!raw) {
    return { id: "site-url", level: "error", message: "NEXT_PUBLIC_SITE_URL n'est pas défini : adresses canoniques, sitemap et partages sociaux seraient faux.", fix: "Définir le domaine réel, en https." };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { id: "site-url", level: "error", message: "NEXT_PUBLIC_SITE_URL n'est pas une adresse valide." };
  }
  if (isLocalHost(url.hostname)) {
    return { id: "site-url", level: "error", message: `NEXT_PUBLIC_SITE_URL pointe vers ${url.hostname} : les liens des courriels et le référencement seraient faux.`, fix: "Définir le domaine réel, en https." };
  }
  if (url.protocol !== "https:") {
    return { id: "site-url", level: "error", message: "NEXT_PUBLIC_SITE_URL n'est pas en https.", fix: "Un site public doit être servi en https." };
  }
  return { id: "site-url", level: "ok", message: `NEXT_PUBLIC_SITE_URL : ${url.origin}.` };
}

function checkMail(env: Env): CheckResult[] {
  const config = resolveMailConfig({ ...env, NODE_ENV: "production" });
  if (config.mode === "error") {
    return [{ id: "mail", level: "error", message: config.reason, fix: "Renseigner les variables SMTP_* (voir .env.example)." }];
  }
  const results: CheckResult[] = [{ id: "mail", level: "ok", message: "Envoi d'emails configuré (SMTP)." }];
  if (config.from === DEFAULT_MAIL_FROM) {
    results.push({ id: "mail-from", level: "warning", message: `L'expéditeur est celui par défaut (${DEFAULT_MAIL_FROM}) : le domaine doit être le vôtre, avec SPF et DKIM configurés, sinon les courriels iront en spam.`, fix: "Définir SMTP_FROM et configurer le DNS du domaine d'envoi." });
  }
  return results;
}

function checkPush(env: Env): CheckResult {
  const config = resolvePushConfig(env);
  if (config.mode === "error") {
    return { id: "push", level: "error", message: `Notifications : ${config.reason}`, fix: "Générer une paire de clés : npm run push:keys (voir .env.example)." };
  }
  if (config.mode === "disabled") {
    return { id: "push", level: "warning", message: "Notifications push désactivées (pas de clés VAPID) : les alertes de recherche n'arrivent que par email.", fix: "Générer une paire de clés : npm run push:keys, puis définir VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT." };
  }
  if (!vapidKeysMatch(config.publicKey, config.privateKey)) {
    return { id: "push", level: "error", message: "VAPID_PRIVATE_KEY ne correspond pas à VAPID_PUBLIC_KEY : tous les envois de notifications seraient refusés.", fix: "Régénérer la paire complète : npm run push:keys." };
  }
  return { id: "push", level: "ok", message: "Notifications push configurées (clés VAPID cohérentes)." };
}

function checkInfrastructure(env: Env): CheckResult[] {
  const results: CheckResult[] = [];

  if (parseTrustedProxyHops(env.TRUSTED_PROXY_HOPS) === null) {
    results.push({ id: "proxy", level: "error", message: "TRUSTED_PROXY_HOPS n'est pas défini : l'adresse IP des visiteurs vient d'un en-tête qu'ils peuvent falsifier, donc toutes les limites par IP se contournent.", fix: "Indiquer le nombre de serveurs intermédiaires de confiance (1 pour un seul nginx ou répartiteur)." });
  } else {
    results.push({ id: "proxy", level: "ok", message: `TRUSTED_PROXY_HOPS = ${env.TRUSTED_PROXY_HOPS}.` });
  }

  if (!env.REDIS_URL) {
    results.push({ id: "redis", level: "warning", message: "Pas de Redis : les limites de débit sont gardées en mémoire, par instance et perdues à chaque redémarrage. Acceptable pour un seul serveur.", fix: "Définir REDIS_URL dès qu'il y a plus d'une instance." });
  } else {
    results.push({ id: "redis", level: "ok", message: "Redis configuré." });
  }

  if (!env.S3_BUCKET) {
    results.push({ id: "storage", level: "warning", message: "Pas de stockage S3 : les photos sont écrites sur le disque du serveur. À sauvegarder avec la base, et impossible avec plusieurs instances.", fix: "Définir S3_* (voir .env.example) ou prévoir la sauvegarde du dossier public/uploads." });
  } else {
    results.push({ id: "storage", level: "ok", message: "Stockage S3 configuré." });
  }

  return results;
}

function checkFacts(facts: LaunchFacts): CheckResult[] {
  if (!facts.dbReachable) {
    return [{ id: "database", level: "error", message: "La base de données est injoignable.", fix: "Vérifier DATABASE_URL et que PostgreSQL est démarré." }];
  }
  const results: CheckResult[] = [{ id: "database", level: "ok", message: "Base de données joignable." }];

  if (facts.migrationsApplied < facts.migrationsOnDisk) {
    results.push({ id: "migrations", level: "error", message: `${facts.migrationsOnDisk - facts.migrationsApplied} migration(s) non appliquée(s) sur cette base.`, fix: "Lancer : npx prisma migrate deploy" });
  } else {
    results.push({ id: "migrations", level: "ok", message: `${facts.migrationsApplied} migrations appliquées.` });
  }

  if (facts.adminUsesDevPassword) {
    results.push({ id: "admin-password", level: "error", message: "Le compte admin@souqauto.dz existe avec le mot de passe de développement publié dans le dépôt.", fix: "Changer ce mot de passe, ou supprimer le compte et créer le vôtre avec ADMIN_EMAIL / ADMIN_PASSWORD." });
  } else {
    results.push({ id: "admin-password", level: "ok", message: "Aucun administrateur avec le mot de passe de développement." });
  }

  if (facts.demoAccounts > 0) {
    results.push({ id: "demo-data", level: "error", message: `${facts.demoAccounts} compte(s) de démonstration ou de test (adresses @example.*) : ne pas mettre en production une base contenant des données de démonstration.`, fix: "Utiliser une base neuve : prisma migrate deploy puis npm run db:seed (données de référence seulement, jamais db:seed:demo)." });
  } else {
    results.push({ id: "demo-data", level: "ok", message: "Aucun compte de démonstration." });
  }

  return results;
}

export function evaluateLaunchReadiness({ env, facts }: { env: Env; facts: LaunchFacts }): CheckResult[] {
  return [
    ...checkSecrets(env),
    ...checkDatabase(env),
    checkSiteUrl(env),
    ...checkMail(env),
    checkPush(env),
    ...checkInfrastructure(env),
    ...checkFacts(facts),
  ];
}

export function summarizeChecks(results: CheckResult[]): { errors: number; warnings: number; ok: number; ready: boolean } {
  const errors = results.filter((r) => r.level === "error").length;
  const warnings = results.filter((r) => r.level === "warning").length;
  return { errors, warnings, ok: results.length - errors - warnings, ready: errors === 0 };
}
