// En-têtes de réponse de sécurité, appliqués à toutes les réponses par le proxy.
// SOURCE UNIQUE (convention du dépôt : toute la logique de requête dans le proxy)
// et framework-agnostique, donc testée par Vitest ; le proxy Next se contente de
// générer un nonce par requête et de poser les en-têtes.
//
// CONFIGURABLE, PAS DE RÈGLE IMPOSÉE (voir ../../../docs/opgi/05) :
//  - `CSP_MODE` : `nonce` (défaut, durci) | `compat` ('unsafe-inline' sur les
//    scripts, sans nonce) | `off` (aucune CSP) ;
//  - `CONTENT_SECURITY_POLICY` : politique verbatim imposée (prioritaire ; chaîne
//    vide = CSP désactivée), sans substitution de nonce ;
//  - `CSP_REPORT_ONLY=true` : CSP en observation (non bloquante), utile pour
//    valider un durcissement avant de l'imposer ;
//  - `HSTS_VALUE` : HSTS, émis uniquement sur une origine sécurisée (HTTPS).
//
// Durcissement par NONCE (mode par défaut) :
//  - `script-src 'self' 'nonce-<n>' 'strict-dynamic'` — plus de 'unsafe-inline'
//    ni 'unsafe-eval' en production ; Next.js applique automatiquement le nonce à
//    ses propres scripts (l'app ne contient aucun <script> inline). Le rendu DOIT
//    être dynamique (forcé dans `src/app/layout.tsx`), sans quoi les pages
//    statiques — dépourvues de nonce — seraient bloquées.
//  - `'unsafe-eval'` reste toléré EN DÉVELOPPEMENT (React l'utilise pour le
//    débogage) ; jamais en production.
//  - `style-src 'self' 'unsafe-inline'` est conservé : les attributs de style
//    inline (`style="…"`, usuels via React) ne sont pas couverts par un nonce et
//    un `style-src` strict casserait la mise en forme ; le risque XSS visé est
//    porté par `script-src`. Durcissement des styles : incrément ultérieur.

export type CspMode = "nonce" | "compat" | "off";

export interface SecurityConfig {
  /** Origine sécurisée (HTTPS) : conditionne HSTS et upgrade-insecure-requests. */
  secure: boolean;
  /** Environnement de développement : tolère 'unsafe-eval' pour React. */
  isDev: boolean;
  /** Stratégie de construction de la CSP. */
  cspMode: CspMode;
  /** Politique imposée verbatim (prioritaire). `undefined` = construite depuis le mode. */
  cspOverride?: string;
  /** true → CSP en Report-Only ; false → bloquante (défaut). */
  cspReportOnly: boolean;
  /** Valeur HSTS complète (uniquement si `secure`). */
  hsts: string;
}

const HSTS_DEFAUT = "max-age=63072000; includeSubDomains";

export function readSecurityConfig(
  env: Record<string, string | undefined> = process.env,
): SecurityConfig {
  const secure =
    env.COOKIE_SECURE !== undefined
      ? env.COOKIE_SECURE === "true"
      : env.NODE_ENV === "production";

  // `CONTENT_SECURITY_POLICY` prioritaire : non défini → construction par mode ;
  // défini vide → CSP désactivée ; défini non vide → imposé verbatim.
  let cspMode: CspMode;
  let cspOverride: string | undefined;
  if (env.CONTENT_SECURITY_POLICY !== undefined) {
    cspOverride = env.CONTENT_SECURITY_POLICY;
    cspMode = env.CONTENT_SECURITY_POLICY === "" ? "off" : "nonce";
  } else {
    cspMode = env.CSP_MODE === "compat" ? "compat" : env.CSP_MODE === "off" ? "off" : "nonce";
  }

  return {
    secure,
    isDev: env.NODE_ENV === "development",
    cspMode,
    cspOverride,
    cspReportOnly: env.CSP_REPORT_ONLY === "true",
    hsts: env.HSTS_VALUE ?? HSTS_DEFAUT,
  };
}

/** Nonce aléatoire par requête (base64, APIs Web disponibles côté edge et Node). */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Construit la valeur CSP pour la requête courante (vide = aucune CSP). */
export function buildCspValue(config: SecurityConfig, nonce: string): string {
  if (config.cspOverride !== undefined) return config.cspOverride;
  if (config.cspMode === "off") return "";

  const scriptSrc =
    config.cspMode === "nonce"
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${config.isDev ? " 'unsafe-eval'" : ""}`
      : `script-src 'self' 'unsafe-inline'${config.isDev ? " 'unsafe-eval'" : ""}`;

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    "connect-src 'self'",
    "form-action 'self'",
    ...(config.secure ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** En-têtes de sécurité à appliquer à la réponse, nonce de la requête inclus. */
export function securityHeaders(config: SecurityConfig, nonce: string): Record<string, string> {
  const h: Record<string, string> = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "cross-origin-opener-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  };
  const csp = buildCspValue(config, nonce);
  if (csp) {
    const nom = config.cspReportOnly ? "content-security-policy-report-only" : "content-security-policy";
    h[nom] = csp;
  }
  if (config.secure && config.hsts) {
    h["strict-transport-security"] = config.hsts;
  }
  return h;
}
