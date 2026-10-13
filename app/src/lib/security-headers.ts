// Lot 134 — en-têtes de sécurité HTTP. Logique pure (aucun accès au réseau ni à Next.js), donc testable seule.
//
// Deux familles, posées à deux endroits :
//  - la POLITIQUE DE SÉCURITÉ DES CONTENUS (CSP) contient un nonce différent à chaque requête : elle est fabriquée par
//    src/proxy.ts pour chaque page ;
//  - les autres en-têtes sont fixes : ils sont posés par next.config.ts sur TOUTES les réponses (pages, API, fichiers).

type Env = Record<string, string | undefined>;

// Nonce : 128 bits aléatoires, propres à une requête. Web Crypto (et non node:crypto) : ce fichier doit aussi
// fonctionner là où le proxy s'exécute.
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// Adresse publique du stockage de photos (S3), seule origine externe d'où le site charge des images : sans elle, la
// politique n'autorise que le site lui-même. Une valeur qui n'est pas une adresse http(s) valide est ignorée.
export function extraImageOrigins(env: Env): string[] {
  const raw = env.S3_PUBLIC_URL?.trim();
  if (!raw) return [];
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? [url.origin] : [];
  } catch {
    return [];
  }
}

// `CSP_REPORT_ONLY=1` : la politique est APPLIQUÉE EN OBSERVATION SEULEMENT (rien n'est bloqué, les violations sont
// signalées). Utile pour un premier déploiement ; à retirer ensuite (npm run launch:check le rappelle).
export function cspHeaderName(env: Env): "Content-Security-Policy" | "Content-Security-Policy-Report-Only" {
  return env.CSP_REPORT_ONLY === "1" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
}

export const CSP_REPORT_PATH = "/api/security/csp-report";

export type CspOptions = {
  nonce: string;
  isDev: boolean;
  imageOrigins?: readonly string[];
  reportUri?: string;
  // Le site est-il servi en https ? Sinon (production essayée en local, en http), promouvoir en https casserait le site.
  upgradeInsecureRequests?: boolean;
};

// La politique. Ce qu'elle interdit compte plus que ce qu'elle autorise :
//  - SCRIPTS : seuls ceux qui portent le nonce de la requête s'exécutent (« strict-dynamic » : ceux-là peuvent en charger
//    d'autres). Un script injecté dans une page (faille XSS) n'a pas ce nonce et ne s'exécute pas. Jamais de
//    'unsafe-inline' pour les scripts. 'unsafe-eval' seulement en développement (React s'en sert pour ses messages d'erreur).
//  - STYLES : 'unsafe-inline' accepté (attributs style= de React, Tailwind) ; un style injecté est un risque bien moindre
//    qu'un script, et un nonce est impossible pour les attributs style=.
//  - Aucune ressource externe : le site n'en charge aucune (ni police, ni script, ni image, ni cadre).
//  - Le site ne peut être affiché dans un cadre par personne (clickjacking), ni charger de plugin, ni changer sa base d'adresses.
export function buildContentSecurityPolicy({ nonce, isDev, imageOrigins = [], reportUri, upgradeInsecureRequests = false }: CspOptions): string {
  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // En développement, next/font/google charge la feuille de style depuis fonts.googleapis.com.
    // En production, la police est auto-hébergée via /_next/static/media/.
    `style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com${isDev ? " https://fonts.googleapis.com" : ""}`,
    `img-src 'self' data: blob: https://*.tile.openstreetmap.org${imageOrigins.length ? ` ${imageOrigins.join(" ")}` : ""}`,
    `font-src 'self'${isDev ? " https://fonts.gstatic.com" : ""}`,
    // En développement, le rechargement à chaud passe par une connexion WebSocket.
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "media-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  // Promeut en https toute ressource demandée en http (filet de sécurité contre un lien en http oublié). Jamais en
  // développement, ni pour un site qui n'est pas servi en https.
  if (!isDev && upgradeInsecureRequests) directives.push("upgrade-insecure-requests");
  if (reportUri) directives.push(`report-uri ${reportUri}`);
  return directives.join("; ");
}

export type HeaderEntry = { key: string; value: string };

// En-têtes fixes, posés sur toutes les réponses.
export function staticSecurityHeaders(production: boolean): HeaderEntry[] {
  const headers: HeaderEntry[] = [
    // Le navigateur ne « devine » pas le type d'un fichier (un envoi déguisé ne devient pas un script).
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Doublon de frame-ancestors pour les navigateurs anciens : le site n'est jamais affiché dans un cadre.
    { key: "X-Frame-Options", value: "DENY" },
    // L'adresse complète n'est envoyée qu'au site lui-même ; aux autres, seulement le nom du site (et jamais en http).
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Fonctions du navigateur que le site n'utilise pas, interdites même à un script injecté.
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
    // Isole la fenêtre du site des fenêtres d'autres sites, tout en laissant fonctionner les fenêtres que le site ouvre
    // lui-même (lien WhatsApp).
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ];
  // HSTS : le navigateur refuse ensuite tout accès en http pendant un an, sous-domaines compris. Seulement en production
  // (il n'a aucun effet en http, mais mieux vaut ne pas l'émettre en développement). Sans « preload » : c'est un
  // engagement à part, à prendre volontairement (docs/EXPLOITATION.md).
  if (production) headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
  return headers;
}
