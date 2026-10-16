// En-têtes de réponse de sécurité, appliqués à toutes les réponses par le proxy.
// SOURCE UNIQUE (convention du dépôt : toute la logique de requête dans le proxy)
// et framework-agnostique, donc testée par Vitest ; le proxy Next ne fait que les
// poser sur la réponse.
//
// CONFIGURABLE, PAS DE RÈGLE IMPOSÉE (voir ../../../docs/opgi/05) :
//  - `CONTENT_SECURITY_POLICY` remplace entièrement la politique (chaîne vide = CSP désactivée) ;
//  - `CSP_REPORT_ONLY=true` passe la CSP en observation (non bloquante), utile pour
//    préparer un durcissement par nonces sans risque de casser une page ;
//  - `HSTS_VALUE` ajuste HSTS, émis uniquement sur une origine sécurisée (HTTPS).
//
// La politique par défaut conserve l'enforcement des directives structurantes
// (frame-ancestors, object-src, base-uri, form-action) ; `script-src`/`style-src`
// tolèrent encore 'unsafe-inline'/'unsafe-eval' pour ne pas casser le runtime Next
// — à retirer via des nonces dans un incrément ultérieur (« à valider »).

export interface SecurityConfig {
  /** Origine sécurisée (HTTPS) : conditionne l'émission de HSTS. */
  secure: boolean;
  /** Politique CSP (chaîne complète). Vide → aucune CSP n'est émise. */
  csp: string;
  /** true → CSP en Report-Only (observation) ; false → CSP bloquante (défaut). */
  cspReportOnly: boolean;
  /** Valeur HSTS complète (uniquement si `secure`). */
  hsts: string;
}

export const CSP_DEFAUT = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self'",
  "form-action 'self'",
].join("; ");

const HSTS_DEFAUT = "max-age=63072000; includeSubDomains";

export function readSecurityConfig(
  env: Record<string, string | undefined> = process.env,
): SecurityConfig {
  const secure =
    env.COOKIE_SECURE !== undefined
      ? env.COOKIE_SECURE === "true"
      : env.NODE_ENV === "production";
  return {
    secure,
    // Chaîne vide explicite = désactivation volontaire de la CSP.
    csp: env.CONTENT_SECURITY_POLICY !== undefined ? env.CONTENT_SECURITY_POLICY : CSP_DEFAUT,
    cspReportOnly: env.CSP_REPORT_ONLY === "true",
    hsts: env.HSTS_VALUE ?? HSTS_DEFAUT,
  };
}

/** En-têtes de sécurité à appliquer, dérivés de la configuration. */
export function securityHeaders(config: SecurityConfig): Record<string, string> {
  const h: Record<string, string> = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "cross-origin-opener-policy": "same-origin",
    // Désactive par défaut des API sensibles du navigateur (configurable plus tard).
    "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  };
  if (config.csp) {
    const nom = config.cspReportOnly ? "content-security-policy-report-only" : "content-security-policy";
    h[nom] = config.csp;
  }
  if (config.secure && config.hsts) {
    h["strict-transport-security"] = config.hsts;
  }
  return h;
}

/** Pose les en-têtes de sécurité sur un objet Headers (mutation en place). */
export function applySecurityHeaders(headers: Headers, config: SecurityConfig): void {
  for (const [k, v] of Object.entries(securityHeaders(config))) {
    headers.set(k, v);
  }
}
