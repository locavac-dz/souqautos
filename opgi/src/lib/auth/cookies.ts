// Cookie de session — attributs de sécurité.
//
// En production : préfixe `__Host-` (exige Secure + Path=/ + sans Domain),
// HttpOnly, SameSite=Lax. En développement sur http, on retombe sur un nom sans
// préfixe `__Host-` et sans Secure (sinon le navigateur refuse le cookie).

export interface CookieOptions {
  /** true en production (https). */
  secure: boolean;
  maxAgeSeconds?: number;
}

const BASE_NAME = "opgi_session";

export function sessionCookieName(secure: boolean): string {
  return secure ? `__Host-${BASE_NAME}` : BASE_NAME;
}

export function buildSessionCookie(token: string, opts: CookieOptions): string {
  const name = sessionCookieName(opts.secure);
  const parts = [
    `${name}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${opts.maxAgeSeconds ?? 8 * 60 * 60}`,
  ];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearCookie(opts: CookieOptions): string {
  const name = sessionCookieName(opts.secure);
  const parts = [`${name}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

/** Lit la valeur d'un cookie dans un en-tête `Cookie` brut. */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    if (pair.slice(0, idx).trim() === name) return pair.slice(idx + 1).trim();
  }
  return null;
}
