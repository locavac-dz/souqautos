import { checkRateLimit } from "@/lib/rate-limit";
import { resolveOpsRecipients } from "@/lib/alert-recipients";
import { escapeHtml, sendEmail } from "@/lib/mailer";
import { redactPath } from "@/lib/csp-report";

// Lot 136 — prévient l'équipe technique quand le SERVEUR plante (erreur 500 d'une page, d'une API ou d'une action).
//
// Sans cela, une erreur n'était vue que si quelqu'un lisait les journaux : une page cassée par une mise à jour
// pouvait rester en panne des heures. Branché sur `onRequestError` de Next.js (src/instrumentation.ts).
//
// Garde-fous, parce qu'une alerte qui ne se maîtrise pas est pire que pas d'alerte :
//  - un courriel par ROUTE et par TYPE d'erreur toutes les 30 minutes ; au plus 6 courriels par heure en tout (une mise en
//    production défectueuse fait tomber cent pages : la boîte de l'équipe ne doit pas exploser) ;
//  - ce qui n'est pas une panne est ignoré (redirection, page introuvable, visiteur qui ferme l'onglet) ;
//  - le courriel ne contient JAMAIS : la pile d'appels, les paramètres d'adresse (jetons, recherches), les cookies ou en-têtes,
//    les adresses e-mail et numéros de téléphone qui traîneraient dans un message d'erreur. Un code (« digest ») permet
//    de retrouver l'erreur complète dans les journaux du serveur, qui restent la source de vérité ;
//  - elle ne lève jamais d'exception et n'attend jamais l'envoi : une alerte en échec ne doit pas aggraver la panne.
// Destinataires : OPS_ALERT_EMAILS, à défaut STAFF_ALERT_EMAILS (src/lib/alert-recipients.ts).

export type ErrorRequest = { path: string; method: string };
export type ErrorContext = { routePath?: string; routeType?: string; routerKind?: string };

export type DescribedError = {
  name: string;
  message: string; // première ligne, masquée, tronquée
  digest: string | null;
  method: string;
  path: string; // sans paramètres d'adresse, jetons masqués
  routePath: string;
  routeType: string;
  signature: string; // ce qui regroupe les erreurs semblables pour la limite d'envoi
};

export const ERROR_ALERT_WINDOW_MS = 30 * 60 * 1000;
export const ERROR_ALERT_GLOBAL_LIMIT = 6; // par heure
const MESSAGE_MAX = 200;

// Adresses e-mail, longues suites de chiffres (téléphones, numéros de pièce) et jetons : jamais dans un courriel d'alerte.
export function maskSensitive(text: string): string {
  return text
    .replace(/[^\s@'"<>()]+@[^\s@'"<>()]+\.[^\s@'"<>()]+/g, "[e-mail]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[numéro]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[…]");
}

function readDigest(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "digest" in error && (error as { digest?: unknown }).digest != null) {
    return String((error as { digest: unknown }).digest).slice(0, 40);
  }
  return null;
}

// Ce qui n'est pas une panne. Les redirections et « introuvable » de Next.js passent par des exceptions (digest
// NEXT_REDIRECT…), et un visiteur qui ferme l'onglet en cours de réponse coupe la connexion : rien à corriger.
export function isIgnorableError(error: unknown): boolean {
  const digest = readDigest(error) ?? "";
  if (/^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/.test(digest)) return true;
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (name === "AbortError" || name === "ResponseAborted") return true;
  return /\b(aborted|ECONNRESET|EPIPE|socket hang up|client disconnected)\b/i.test(message);
}

export function describeServerError(error: unknown, request: ErrorRequest, context: ErrorContext): DescribedError {
  const name = error instanceof Error && error.name ? error.name : typeof error === "string" ? "Error" : "Erreur inconnue";
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const message = maskSensitive(raw.split("\n").map((line) => line.trim()).find(Boolean) ?? "").slice(0, MESSAGE_MAX);
  const pathname = (request.path ?? "").split("?")[0].split("#")[0];
  const routePath = context.routePath ?? "(inconnue)";
  return {
    name,
    message,
    digest: readDigest(error),
    method: (request.method ?? "GET").toUpperCase().slice(0, 10),
    path: redactPath(pathname).slice(0, 200),
    routePath,
    routeType: context.routeType ?? "?",
    signature: `${routePath}|${name}`,
  };
}

const ROUTE_TYPE_LABEL: Record<string, string> = {
  render: "affichage d'une page",
  route: "API",
  action: "action d'un formulaire",
  proxy: "filtre des requêtes (proxy)",
};

export function buildServerErrorEmail(described: DescribedError, when: Date): { subject: string; html: string } {
  const subject = `[Souq Auto] Erreur du serveur : ${described.routePath} (${described.name})`.slice(0, 200);
  const rows: [string, string][] = [
    ["Quand", when.toISOString().replace("T", " ").slice(0, 19) + " UTC"],
    ["Où", `${described.method} ${described.path}`],
    ["Écran ou API", described.routePath],
    ["Contexte", ROUTE_TYPE_LABEL[described.routeType] ?? described.routeType],
    ["Erreur", `${described.name}${described.message ? ` : ${described.message}` : ""}`],
    ...(described.digest ? ([["Code à chercher dans les journaux", described.digest]] as [string, string][]) : []),
  ];
  const html =
    `<p>Bonjour,</p><p>Le serveur a rencontré une erreur :</p>` +
    `<table cellpadding="4" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="color:#475569;vertical-align:top">${escapeHtml(k)}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`).join("")}</table>` +
    `<p>Le détail complet (pile d'appels) est dans les journaux du serveur${described.digest ? `, en cherchant le code ci-dessus` : ""}.</p>` +
    `<p style="color:#64748b;font-size:12px">Ce message n'est envoyé qu'une fois par écran et par type d'erreur toutes les 30 minutes (6 par heure au plus, au total).</p>`;
  return { subject, html };
}

export async function reportServerError(error: unknown, request: ErrorRequest, context: ErrorContext): Promise<void> {
  try {
    if (isIgnorableError(error)) return;
    const described = describeServerError(error, request, context);
    // Toujours dans les journaux (une ligne, sans pile ni paramètres), qu'un courriel parte ou non.
    console.error(`[erreur] ${described.method} ${described.path} — ${described.routePath} (${described.routeType}) — ${described.name}${described.digest ? ` [${described.digest}]` : ""} : ${described.message}`);

    const recipients = resolveOpsRecipients(process.env);
    if (recipients.length === 0) return;
    if (!(await checkRateLimit(`server-error-alert:${described.signature}`, { limit: 1, windowMs: ERROR_ALERT_WINDOW_MS }))) return;
    if (!(await checkRateLimit("server-error-alert:all", { limit: ERROR_ALERT_GLOBAL_LIMIT, windowMs: 60 * 60 * 1000 }))) return;

    const email = buildServerErrorEmail(described, new Date());
    await Promise.all(
      recipients.map((to) =>
        sendEmail({ to, subject: email.subject, html: email.html }).catch((err) => {
          console.error(`[erreur] échec d'envoi de l'alerte à ${to} : ${(err as Error).message}`);
        }),
      ),
    );
  } catch (failure) {
    console.error(`[erreur] l'alerte n'a pas pu être traitée : ${(failure as Error).message}`);
  }
}
