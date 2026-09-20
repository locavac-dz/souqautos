// Lot 134 — rapports de violation de la politique de sécurité des contenus (CSP). Le navigateur les envoie à
// /api/security/csp-report quand il bloque (ou, en mode observation, aurait bloqué) une ressource. Ils servent à repérer,
// après la mise en ligne, une page ou une ressource que la politique casse.
//
// Ce module réduit un rapport à ce qui est utile ET sans donnée personnelle avant de l'écrire dans les journaux :
// jamais la requête d'une adresse (`?…`), jamais un jeton (les liens de réinitialisation de mot de passe, de vérification
// d'e-mail ou les identifiants d'annonce portent un long identifiant DANS le chemin) : tout segment qui y ressemble est masqué.

export type CspViolation = { directive: string; blocked: string; page: string; source: string; line: number | null };

// Un segment d'adresse est pris pour un jeton ou un identifiant s'il est LONG et contient un chiffre, une majuscule ou un
// « _ » : ce que font les jetons (aléatoires, 43 caractères), les identifiants d'annonce et les empreintes, et ce que ne
// fait jamais un mot lisible en minuscules (« reinitialiser-mot-de-passe », « conditions-generales »), qui reste visible.
const TOKEN_LIKE = /^(?=.*[0-9A-Z_])[A-Za-z0-9_-]{20,}$/;
const KEYWORDS = new Set(["inline", "eval", "data", "blob", "self", "wasm-eval", "url", "trusted-types-policy", "trusted-types-sink"]);
const EXTENSION_SCHEMES = ["chrome-extension", "moz-extension", "safari-extension", "safari-web-extension", "ms-browser-extension", "webkit-masked-url"];

export function redactPath(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => (TOKEN_LIKE.test(segment) ? "[…]" : segment))
    .join("/");
}

// Réduit une adresse à origine + chemin masqué. Renvoie le nom du schéma pour une extension du navigateur (bruit sans
// rapport avec le site), un mot-clé connu tel quel (« inline », « eval »…), ou « autre ».
export function reduceUrl(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "";
  const trimmed = value.trim().slice(0, 500);
  if (KEYWORDS.has(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const scheme = url.protocol.replace(":", "");
    if (EXTENSION_SCHEMES.includes(scheme)) return scheme;
    if (scheme === "http" || scheme === "https" || scheme === "ws" || scheme === "wss") return `${url.origin}${redactPath(url.pathname)}`.slice(0, 200);
    return scheme;
  } catch {
    return "autre";
  }
}

export function isBrowserExtensionNoise(violation: CspViolation): boolean {
  return [violation.blocked, violation.source].some((value) => EXTENSION_SCHEMES.includes(value));
}

const cleanDirective = (value: unknown): string => (typeof value === "string" ? value.split(" ")[0].replace(/[^a-z-]/gi, "").slice(0, 40) : "");
const cleanLine = (value: unknown): number | null => (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 1_000_000 ? value : null);

// Deux formats existent : l'ancien (`report-uri`, { "csp-report": {…} }) et l'interface Reporting API
// ([{ type: "csp-violation", body: {…} }]). Tout autre contenu est ignoré.
export function parseCspReport(text: string): CspViolation | null {
  if (text.length === 0 || text.length > 8192) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }

  const legacy = (json as { "csp-report"?: Record<string, unknown> } | null)?.["csp-report"];
  if (legacy && typeof legacy === "object") {
    return {
      directive: cleanDirective(legacy["effective-directive"] ?? legacy["violated-directive"]),
      blocked: reduceUrl(legacy["blocked-uri"]),
      page: reduceUrl(legacy["document-uri"]),
      source: reduceUrl(legacy["source-file"]),
      line: cleanLine(legacy["line-number"]),
    };
  }

  const entry = Array.isArray(json) ? json.find((item) => item && typeof item === "object" && (item as { type?: unknown }).type === "csp-violation") : null;
  const body = (entry as { body?: Record<string, unknown> } | null)?.body;
  if (body && typeof body === "object") {
    return {
      directive: cleanDirective(body.effectiveDirective ?? body.violatedDirective),
      blocked: reduceUrl(body.blockedURL ?? body.blockedURI),
      page: reduceUrl(body.documentURL ?? body.documentURI),
      source: reduceUrl(body.sourceFile),
      line: cleanLine(body.lineNumber),
    };
  }
  return null;
}
