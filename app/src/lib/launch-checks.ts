import { staffTwoFactorRequired } from "@/lib/staff-two-factor";
import { resolveOpsRecipients } from "@/lib/alert-recipients";
import { resolveMailConfig, DEFAULT_MAIL_FROM } from "@/lib/mail-config";
import { parseTrustedProxyHops } from "@/lib/client-ip";
import { resolvePushConfig, vapidKeysMatch } from "@/lib/push";
import { resolveGoogleConfig } from "@/lib/google-oauth";
import { verificationStatus } from "@/lib/seo-verification";

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
  // Lot 138 — comptes d'équipe (administrateurs, modérateurs) actifs SANS double authentification.
  staffWithoutTwoFactor?: number;
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

// Lot 132 — connexion avec Google (facultative). Sans identifiant NI secret, le bouton n'apparaît pas ; un seul des deux
// est une erreur (jamais un bouton qui ne marcherait pas). L'adresse de retour affichée est celle à déclarer, telle
// quelle, dans la console Google Cloud : une différence d'un seul caractère fait refuser toutes les connexions.
function checkGoogleLogin(env: Env): CheckResult {
  const resolution = resolveGoogleConfig({ ...env, NODE_ENV: "production" }, env.NEXT_PUBLIC_SITE_URL ?? "");
  if (resolution.mode === "error") {
    return { id: "google-login", level: "error", message: `Connexion avec Google : ${resolution.reason}`, fix: "Définir GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET ensemble (voir .env.example), ou aucun des deux." };
  }
  if (resolution.mode === "disabled") {
    return { id: "google-login", level: "warning", message: "Connexion avec Google désactivée (facultative) : ni GOOGLE_CLIENT_ID ni GOOGLE_CLIENT_SECRET ne sont définis.", fix: "Voir docs/EXPLOITATION.md, section « Connexion avec Google »." };
  }
  if (!resolution.config.clientId.endsWith(".apps.googleusercontent.com")) {
    return { id: "google-login", level: "warning", message: "GOOGLE_CLIENT_ID n'a pas la forme d'un identifiant Google (…apps.googleusercontent.com) : vérifier qu'il vient bien de la console Google Cloud.", fix: "Copier l'identifiant client OAuth tel qu'il est affiché dans Google Cloud, sans espace." };
  }
  return { id: "google-login", level: "ok", message: `Connexion avec Google configurée. Adresse de retour à déclarer dans Google Cloud : ${resolution.config.redirectUri}` };
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

// Lot 124 — Google Search Console : sans code de vérification publié sur la page d'accueil, il est
// impossible de prouver que le site vous appartient, donc de soumettre le plan du site ou de voir
// comment Google l'explore. Non bloquant : le site fonctionne sans, mais le référencement se pilote à l'aveugle.
function checkSearchConsole(env: Env): CheckResult {
  const status = verificationStatus(env.GOOGLE_SITE_VERIFICATION);
  if (status === "valid") {
    return { id: "search-console", level: "ok", message: "Code de vérification Google Search Console défini." };
  }
  if (status === "invalid") {
    return { id: "search-console", level: "warning", message: "GOOGLE_SITE_VERIFICATION n'a pas la forme d'un code de vérification : la balise ne sera pas publiée.", fix: "Copier uniquement la valeur content=\"…\" fournie par Search Console (méthode « balise HTML »)." };
  }
  return { id: "search-console", level: "warning", message: "Pas de code de vérification Google Search Console : impossible de soumettre le plan du site ni de suivre l'exploration par Google.", fix: "Ajouter la propriété du site dans Search Console (méthode « balise HTML »), puis définir GOOGLE_SITE_VERIFICATION." };
}

// Lot 134 — la politique de sécurité des contenus (src/proxy.ts) peut être mise en mode « observation » (CSP_REPORT_ONLY=1) :
// le navigateur signale ce qu'il aurait bloqué mais ne bloque RIEN. Utile quelques jours pour repérer un oubli avant de
// durcir, dangereux s'il y reste : le site n'est alors protégé contre l'injection de scripts que sur le papier.
function checkSecurityPolicy(env: Env): CheckResult {
  if (env.CSP_REPORT_ONLY === "1") {
    return { id: "csp", level: "warning", message: "La politique de sécurité des contenus est en mode observation (CSP_REPORT_ONLY=1) : elle signale mais ne bloque rien, un script injecté dans une page s'exécuterait.", fix: "Après avoir relu les rapports (« [csp] » dans les journaux), retirer CSP_REPORT_ONLY. Voir docs/EXPLOITATION.md, section « En-têtes de sécurité »." };
  }
  return { id: "csp", level: "ok", message: "Politique de sécurité des contenus appliquée (bloque les scripts non autorisés)." };
}

// Lot 236 — sans CRON_SECRET, le point de terminaison /api/cron/sweep répond 500 et la tâche cron planifiée échoue.
// Non bloquant : le site fonctionne, mais les annonces ne sont plus expirées, rappelées ou renouvelées automatiquement.
function checkCronSweep(env: Env): CheckResult {
  if (!isPlaceholder(env.CRON_SECRET)) {
    return { id: "cron-sweep", level: "ok", message: "CRON_SECRET configuré (balayage nocturne des annonces)." };
  }
  return {
    id: "cron-sweep",
    level: "warning",
    message: "CRON_SECRET absent ou resté à sa valeur d'exemple : la tâche cron de balayage des annonces (expiration, rappels, renouvellement auto) ne fonctionnerait pas.",
    fix: "Générer : node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\" puis définir CRON_SECRET, et planifier npm run cron:sweep (ops/crontab.example).",
  };
}

// Lot 136 — sans destinataire, les alertes techniques (sauvegarde en retard ou en échec, erreurs du serveur) ne partent nulle
// part : les problèmes ne sont alors vus que si quelqu'un lit les journaux. Non bloquant, mais c'est ce qui transforme
// « on l'a découvert au jour du sinistre » en « on a été prévenu la nuit même ».
function checkAlertRecipients(env: Env): CheckResult {
  const recipients = resolveOpsRecipients(env);
  if (recipients.length > 0) {
    return { id: "ops-alerts", level: "ok", message: `Alertes techniques (sauvegardes, erreurs du serveur) envoyées à ${recipients.length} adresse(s).` };
  }
  return {
    id: "ops-alerts",
    level: "warning",
    message: "Aucun destinataire d'alertes techniques : une sauvegarde qui cesse de tourner ou une page en erreur ne préviendrait personne.",
    fix: "Définir OPS_ALERT_EMAILS (ou STAFF_ALERT_EMAILS), puis planifier npm run ops:check -- --notify (docs/EXPLOITATION.md, section 3).",
  };
}

// Lot 138 — la double authentification de l'ÉQUIPE : exigée par défaut en production. « 0 » la désactive : le compte d'un
// administrateur (dont le mot de passe peut fuiter, être deviné, ou être réutilisé d'un autre site) redevient sa seule protection.
function checkStaffTwoFactor(env: Env, facts: LaunchFacts): CheckResult[] {
  const required = staffTwoFactorRequired({ ...env, NODE_ENV: "production" });
  const results: CheckResult[] = [];
  if (!required) {
    results.push({ id: "staff-2fa", level: "warning", message: "La double authentification n'est PAS exigée de l'équipe (REQUIRE_STAFF_2FA=0) : un mot de passe administrateur volé suffit à prendre le site.", fix: "Retirer REQUIRE_STAFF_2FA (elle est exigée par défaut en production)." });
    return results;
  }
  results.push({ id: "staff-2fa", level: "ok", message: "La double authentification est exigée de l'équipe (administrateurs et modérateurs)." });
  const missing = facts.staffWithoutTwoFactor ?? 0;
  if (missing > 0) {
    results.push({
      id: "staff-2fa-accounts",
      level: "warning",
      message: `${missing} compte(s) d'équipe sans double authentification : ils n'auront que les droits d'un compte ordinaire tant qu'elle n'est pas activée.`,
      fix: "Chacun se connecte, ouvre « Sécurité du compte » (/compte/securite) et l'active. Perdu l'accès ? npm run auth:reset-2fa -- --email …",
    });
  }
  return results;
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
    checkGoogleLogin(env),
    checkSearchConsole(env),
    checkSecurityPolicy(env),
    checkAlertRecipients(env),
    checkCronSweep(env),
    ...checkStaffTwoFactor(env, facts),
    ...checkInfrastructure(env),
    ...checkFacts(facts),
  ];
}

export function summarizeChecks(results: CheckResult[]): { errors: number; warnings: number; ok: number; ready: boolean } {
  const errors = results.filter((r) => r.level === "error").length;
  const warnings = results.filter((r) => r.level === "warning").length;
  return { errors, warnings, ok: results.length - errors - warnings, ready: errors === 0 };
}
