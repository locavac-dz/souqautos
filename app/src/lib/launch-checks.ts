import { staffTwoFactorRequired } from "@/lib/staff-two-factor";
import { parseAlertEmails, resolveOpsRecipients } from "@/lib/alert-recipients";
import { resolveMailConfig, resolveReplyTo, DEFAULT_MAIL_FROM } from "@/lib/mail-config";
import { parseTrustedProxyHops } from "@/lib/client-ip";
import { resolvePushConfig, vapidKeysMatch } from "@/lib/push";
import { resolveGoogleConfig } from "@/lib/google-oauth";
import { verificationStatus } from "@/lib/seo-verification";
import { CHARGILY_WEBHOOK_PATH, resolveChargilyConfig } from "@/lib/chargily";

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
  // Le compte admin@souqauto.com existe ET son mot de passe est celui du README.
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

// Lot 265 (audit 2026-10-08, constat A5) — sans Twilio, `sendSms` journalisait et rendait la main : la vérification du
// téléphone affichait « code envoyé » sans jamais rien envoyer, et ce contrôle n'existait pas.
function checkSms(env: Env): CheckResult {
  const sid = env.TWILIO_ACCOUNT_SID?.trim();
  const token = env.TWILIO_AUTH_TOKEN?.trim();
  const from = env.TWILIO_FROM_NUMBER?.trim();
  const fix = "Définir TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_FROM_NUMBER (voir .env.example) depuis la console Twilio.";
  if (!sid && !token && !from) {
    return { id: "sms", level: "error", message: "Envoi de SMS non configuré (TWILIO_*) : la vérification du numéro de téléphone afficherait « code envoyé » sans jamais rien envoyer.", fix };
  }
  if (!sid || !token || !from) {
    return { id: "sms", level: "error", message: "Configuration Twilio incomplète : les trois variables TWILIO_* sont nécessaires ensemble.", fix };
  }
  if (!/^\+[1-9]\d{6,14}$/.test(from)) {
    return { id: "sms", level: "error", message: `TWILIO_FROM_NUMBER (${from}) n'est pas un numéro au format E.164 (ex. +12015551234) : Twilio refuserait chaque envoi.`, fix: "Copier le numéro expéditeur tel qu'il apparaît dans la console Twilio, avec l'indicatif et sans espace." };
  }
  if (!/^AC[0-9a-fA-F]{32}$/.test(sid)) {
    return { id: "sms", level: "warning", message: "TWILIO_ACCOUNT_SID n'a pas la forme d'un Account SID Twilio (AC suivi de 32 caractères hexadécimaux) : vérifier qu'il vient bien de la console Twilio.", fix: "Copier l'Account SID affiché sur le tableau de bord Twilio." };
  }
  return { id: "sms", level: "ok", message: "Envoi de SMS configuré (Twilio)." };
}

// Lot 265 (constat A5) — sans ADMIN_EMAIL, le formulaire de contact retombait sur l'adresse de développement
// admin@souqauto.com (domaine non maîtrisé) sans aucune erreur, et le compte administrateur de production n'est pas créé.
function checkAdminEmail(env: Env): CheckResult {
  const value = env.ADMIN_EMAIL?.trim();
  const fix = "Définir ADMIN_EMAIL (adresse réellement lue par l'équipe) et ADMIN_PASSWORD (voir .env.example).";
  if (!value) {
    return { id: "admin-email", level: "error", message: "ADMIN_EMAIL n'est pas défini : les messages du formulaire de contact n'auraient aucun destinataire réel, et le compte administrateur de production ne serait pas créé par db:seed.", fix };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { id: "admin-email", level: "error", message: "ADMIN_EMAIL n'est pas une adresse email valide.", fix };
  }
  return { id: "admin-email", level: "ok", message: `ADMIN_EMAIL : ${value} (destinataire du formulaire de contact, compte administrateur).` };
}

// Lot 264 — paiement en ligne (Chargily Pay, CIB / Edahabia), facultatif : sans clé, seuls les virements
// manuels sont proposés. Une clé de TEST en production est une erreur (le site proposerait « payer en
// ligne » sans jamais rien encaisser). Le webhook est déclaré par checkout (pas dans le tableau de bord
// Chargily), mais l'adresse doit être joignable depuis Internet.
function checkChargily(env: Env): CheckResult {
  const resolution = resolveChargilyConfig({ ...env, NODE_ENV: "production" });
  if (resolution.mode === "error") {
    return { id: "chargily", level: "error", message: `Paiement en ligne (Chargily Pay) : ${resolution.reason}`, fix: "Copier la clé secrète LIVE (live_sk_…) depuis le tableau de bord Chargily Pay, ou retirer CHARGILY_SECRET_KEY." };
  }
  if (resolution.mode === "disabled") {
    return { id: "chargily", level: "warning", message: "Paiement en ligne (Chargily Pay) désactivé : les formules et abonnements ne se paient que par virement, avec rapprochement humain.", fix: "Définir CHARGILY_SECRET_KEY (clé live_sk_… d'un compte Chargily Pay vérifié). Voir .env.example." };
  }
  const site = (env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (env.CHARGILY_API_BASE_URL?.trim()) {
    // Ignorée en production (resolveChargilyConfig), mais sa présence dans un .env de production trahit une configuration
    // de test copiée telle quelle (Lot 267, audit B7).
    return { id: "chargily", level: "warning", message: "CHARGILY_API_BASE_URL est défini : cette variable de TEST (faux serveur) est ignorée en production, mais sa présence signale un fichier de configuration copié depuis un poste de développement.", fix: "Retirer CHARGILY_API_BASE_URL de la configuration de production." };
  }
  return { id: "chargily", level: "ok", message: `Paiement en ligne Chargily Pay configuré (mode live). Webhook appelé par Chargily : ${site}${CHARGILY_WEBHOOK_PATH}` };
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
  } else if (!env.S3_PUBLIC_URL?.trim()) {
    // Lot 267 (audit B7) — storage.ts construit l'adresse publique des photos à partir de S3_PUBLIC_URL : sans elle, chaque
    // photo est enregistrée sous « /<clé> » et répond 404.
    results.push({ id: "storage", level: "error", message: "S3_BUCKET est défini mais pas S3_PUBLIC_URL : chaque photo envoyée serait enregistrée avec une adresse fausse (404).", fix: "Définir S3_PUBLIC_URL (adresse de base lue par les navigateurs, voir .env.example)." });
  } else if (!env.S3_ACCESS_KEY_ID?.trim() || !env.S3_SECRET_ACCESS_KEY?.trim()) {
    results.push({ id: "storage", level: "error", message: "S3_BUCKET est défini sans S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY : les envois de photos échoueraient (repli disque local silencieux).", fix: "Définir les identifiants du compte de stockage (voir .env.example)." });
  } else {
    results.push({ id: "storage", level: "ok", message: `Stockage S3 configuré (${env.S3_BUCKET}).` });
    if (!env.S3_ENDPOINT?.trim()) {
      results.push({ id: "storage-endpoint", level: "warning", message: "S3_ENDPOINT n'est pas défini : seul AWS S3 fonctionne sans ; un autre fournisseur (MinIO, OVH, Scaleway…) a besoin de son adresse.", fix: "Définir S3_ENDPOINT, sauf sur AWS." });
    }
  }

  // Lot 267 (audit B7) — un cache désactivé (0) est prévu pour les tests, jamais pour la production (mesuré : la recherche
  // passe de 458 à 1 491 ms à 10 visiteurs sans le cache de réactivité).
  for (const [name, label] of [["RESPONSIVENESS_CACHE_TTL_MS", "réactivité des vendeurs"], ["CATALOGUE_STATS_CACHE_TTL_MS", "agrégats du catalogue"]] as const) {
    if (env[name]?.trim() === "0") {
      results.push({ id: "cache", level: "warning", message: `${name}=0 : le cache des ${label} est désactivé, ce qui multiplie les requêtes sur les pages de résultats.`, fix: `Retirer ${name} (valeur par défaut) ou lui donner une durée en millisecondes.` });
    }
  }

  return results;
}

// Lot 267 (audit B7) — STAFF_ALERT_EMAILS n'était contrôlé que comme repli des alertes techniques : avec OPS_ALERT_EMAILS
// défini et STAFF_ALERT_EMAILS absent, launch:check disait « ok » alors que la file de modération (annonces, avis,
// identités, signalements, paiements à examiner) ne prévenait personne.
// Lot 273 — sans adresse de réponse, les réponses des clients aux notifications partent vers l'expéditeur technique.
function checkReplyTo(env: Env): CheckResult {
  const replyTo = resolveReplyTo(env);
  if (replyTo) {
    return { id: "mail-reply-to", level: "ok", message: `Adresse de réponse des courriels : .` };
  }
  return {
    id: "mail-reply-to",
    level: "warning",
    message: "Aucune adresse de réponse (MAIL_REPLY_TO, STAFF_ALERT_EMAILS ou ADMIN_EMAIL) : un client qui répond à un courriel du site écrit dans le vide.",
    fix: "Définir MAIL_REPLY_TO (boîte lue par l'équipe).",
  };
}

function checkStaffAlerts(env: Env): CheckResult {
  const recipients = parseAlertEmails(env.STAFF_ALERT_EMAILS);
  if (recipients.length > 0) {
    return { id: "staff-alerts", level: "ok", message: `Alertes de modération envoyées à ${recipients.length} adresse(s).` };
  }
  return {
    id: "staff-alerts",
    level: "warning",
    message: "STAFF_ALERT_EMAILS n'est pas défini : une annonce, un avis, une demande d'identité, un signalement ou un paiement à examiner ne prévient personne — la file n'est vue qu'en ouvrant le back-office.",
    fix: "Définir STAFF_ALERT_EMAILS (adresses de l'équipe de modération, séparées par des virgules).",
  };
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
    results.push({ id: "admin-password", level: "error", message: "Le compte admin@souqauto.com existe avec le mot de passe de développement publié dans le dépôt.", fix: "Changer ce mot de passe, ou supprimer le compte et créer le vôtre avec ADMIN_EMAIL / ADMIN_PASSWORD." });
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
    checkSms(env),
    checkAdminEmail(env),
    checkPush(env),
    checkGoogleLogin(env),
    checkSearchConsole(env),
    checkSecurityPolicy(env),
    checkAlertRecipients(env),
    checkStaffAlerts(env),
    checkReplyTo(env),
    checkCronSweep(env),
    checkChargily(env),
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
