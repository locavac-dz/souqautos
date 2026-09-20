import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

// Lot 132 — connexion avec un compte Google : OpenID Connect, « code d'autorisation » avec PKCE.
//
// Ce module ne fait AUCUN appel réseau sauf `exchangeCodeForIdToken` (appel serveur à serveur vers Google) : le reste
// est pur et testé. Ce que fait la connexion, dans l'ordre :
//   1. /api/auth/google/start prépare un état, un nonce et un vérificateur PKCE, les scelle dans un cookie court
//      (10 min, signé, illisible côté script) et renvoie le navigateur vers Google ;
//   2. Google renvoie le navigateur sur /api/auth/google/callback avec un code ;
//   3. le serveur vérifie l'état, échange le code contre le jeton d'identité (avec le vérificateur PKCE et le secret
//      du client), vérifie ses revendications, puis ouvre — ou crée — le compte du site.
//
// Le jeton d'identité est reçu DIRECTEMENT du point d'échange de Google, en HTTPS, avec notre secret : la spécification
// OpenID Connect (Core, 3.1.3.7) permet dans ce cas de s'appuyer sur la validation TLS du serveur au lieu de vérifier
// la signature du jeton. On vérifie en revanche l'émetteur, le destinataire, l'expiration, le nonce et l'adresse.

type Env = Record<string, string | undefined>;

export const GOOGLE_PROVIDER = "google";
export const GOOGLE_FLOW_COOKIE = "souq_auto_google_flow";
export const GOOGLE_FLOW_PATH = "/api/auth/google";
export const GOOGLE_FLOW_MAX_AGE_SECONDS = 10 * 60;
export const GOOGLE_LOGIN_LOCALES = ["fr", "ar"] as const;
export type GoogleLoginLocale = (typeof GOOGLE_LOGIN_LOCALES)[number];
export const DEFAULT_NEXT_PATH = "/compte/tableau-de-bord";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const EXCHANGE_TIMEOUT_MS = 10_000;

export type GoogleOAuthConfig = { clientId: string; clientSecret: string; authUrl: string; tokenUrl: string; redirectUri: string };
export type GoogleConfigResolution =
  | { mode: "disabled" }
  | { mode: "error"; reason: string }
  | { mode: "enabled"; config: GoogleOAuthConfig };

// Sans identifiant ET sans secret : la fonction est désactivée (le bouton n'apparaît pas). Avec un seul des deux :
// c'est une erreur de configuration, jamais un bouton qui ne marcherait pas.
//
// `GOOGLE_OAUTH_TEST_BASE_URL` remplace les adresses de Google par un faux serveur, POUR LES TESTS UNIQUEMENT :
// ignorée en production, quelle que soit la configuration.
export function resolveGoogleConfig(env: Env, siteUrl: string): GoogleConfigResolution {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId && !clientSecret) return { mode: "disabled" };
  if (!clientId || !clientSecret) {
    return { mode: "error", reason: `${clientId ? "GOOGLE_CLIENT_SECRET" : "GOOGLE_CLIENT_ID"} est absent alors que l'autre est défini.` };
  }
  const testBase = env.NODE_ENV !== "production" ? env.GOOGLE_OAUTH_TEST_BASE_URL?.trim().replace(/\/$/, "") : undefined;
  return {
    mode: "enabled",
    config: {
      clientId,
      clientSecret,
      authUrl: testBase ? `${testBase}/auth` : GOOGLE_AUTH_URL,
      tokenUrl: testBase ? `${testBase}/token` : GOOGLE_TOKEN_URL,
      redirectUri: `${siteUrl.replace(/\/$/, "")}/api/auth/google/callback`,
    },
  };
}

export function isGoogleLoginEnabled(env: Env, siteUrl: string): boolean {
  return resolveGoogleConfig(env, siteUrl).mode === "enabled";
}

// --- Jetons aléatoires et PKCE -------------------------------------------------------------------------------------

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

// PKCE (RFC 7636), méthode S256 : Google ne reçoit que l'empreinte ; le vérificateur reste dans le cookie scellé, et
// n'est révélé qu'au point d'échange — un code intercepté en chemin est alors inutilisable.
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// --- Cookie de déroulement (état, nonce, vérificateur) -------------------------------------------------------------

export type GoogleFlow = { state: string; nonce: string; verifier: string; locale: GoogleLoginLocale; next: string };
const FLOW_PURPOSE = "google-oauth-flow";

function flowKey(env: Env): Uint8Array {
  const secret = env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET manquant — voir .env.example");
  return new TextEncoder().encode(secret);
}

// Signé avec JWT_SECRET, mais avec une « intention » propre : ce cookie ne peut jamais servir de session (il n'a ni
// `sub` ni `role`), et une session ne peut jamais servir de cookie de déroulement.
export async function sealFlow(flow: GoogleFlow, env: Env = process.env): Promise<string> {
  return new SignJWT({ purpose: FLOW_PURPOSE, ...flow })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${GOOGLE_FLOW_MAX_AGE_SECONDS}s`)
    .sign(flowKey(env));
}

export async function openFlow(token: string | undefined, env: Env = process.env): Promise<GoogleFlow | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, flowKey(env));
    const { purpose, state, nonce, verifier, locale, next } = payload as Record<string, unknown>;
    if (purpose !== FLOW_PURPOSE) return null;
    if (typeof state !== "string" || typeof nonce !== "string" || typeof verifier !== "string" || typeof next !== "string") return null;
    if (locale !== "fr" && locale !== "ar") return null;
    return { state, nonce, verifier, locale, next };
  } catch {
    return null;
  }
}

export function pickLoginLocale(value: string | null | undefined): GoogleLoginLocale {
  return value === "ar" ? "ar" : "fr";
}

// --- Adresse de retour ---------------------------------------------------------------------------------------------

// La page où renvoyer la personne après la connexion vient de l'adresse (`?next=`) : un lien piégé ne doit jamais
// pouvoir l'envoyer vers un autre site (redirection ouverte). Seul un chemin interne, sans schéma, sans « // »,
// sans antislash et hors de l'API est accepté ; sinon, le tableau de bord. Le préfixe de langue est retiré (il est
// ajouté à la fin).
const SAFE_PATH = /^\/[A-Za-z0-9\-._~/%]*(\?[A-Za-z0-9\-._~%=&/]*)?$/;
export function sanitizeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 200) return DEFAULT_NEXT_PATH;
  if (!SAFE_PATH.test(raw) || raw.startsWith("//") || raw.includes("..") || /^\/api(\/|$)/.test(raw)) return DEFAULT_NEXT_PATH;
  const rest = raw.replace(/^\/(fr|ar)(?=\/|\?|$)/, "");
  const path = rest === "" || rest.startsWith("?") ? `/${rest}` : rest;
  // L'accueil (avec ou sans paramètres) n'est pas une destination utile après une connexion : tableau de bord.
  return path.split("?")[0] === "/" ? DEFAULT_NEXT_PATH : path;
}

// --- Adresse d'autorisation ----------------------------------------------------------------------------------------

export function buildAuthorizationUrl(config: GoogleOAuthConfig, input: { state: string; nonce: string; challenge: string; locale: GoogleLoginLocale }): string {
  const url = new URL(config.authUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  // Le strict nécessaire : l'identité (openid), l'adresse (email) et le nom (profile). Aucun accès à Gmail, Drive, etc.
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  // Laisse choisir le compte Google plutôt que d'ouvrir silencieusement celui qui est déjà connecté au navigateur.
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("hl", input.locale);
  return url.toString();
}

// --- Échange du code -----------------------------------------------------------------------------------------------

export class GoogleExchangeError extends Error {}

export async function exchangeCodeForIdToken(
  config: GoogleOAuthConfig,
  input: { code: string; verifier: string },
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.verifier,
  });
  let response: Response;
  try {
    response = await fetchImpl(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
    });
  } catch (error) {
    throw new GoogleExchangeError(`appel impossible (${(error as Error).name})`);
  }
  // Ni le corps de la réponse ni la requête ne sont repris dans le message : ils peuvent contenir le secret ou le code.
  if (!response.ok) throw new GoogleExchangeError(`refus de Google (statut ${response.status})`);
  const json = (await response.json().catch(() => null)) as { id_token?: unknown } | null;
  if (!json || typeof json.id_token !== "string" || json.id_token.length === 0) throw new GoogleExchangeError("réponse sans jeton d'identité");
  return json.id_token;
}

// --- Jeton d'identité ----------------------------------------------------------------------------------------------

export function decodeIdTokenClaims(idToken: string): Record<string, unknown> | null {
  const parts = idToken.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const parsed = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export type GoogleProfile = { sub: string; email: string; name?: string };
export type ClaimsRefusal = "issuer" | "audience" | "expired" | "nonce" | "subject" | "email_missing" | "email_unverified";

export function validateIdTokenClaims(
  claims: Record<string, unknown>,
  expected: { clientId: string; nonce: string; now: Date }
): { ok: true; profile: GoogleProfile } | { ok: false; reason: ClaimsRefusal } {
  if (typeof claims.iss !== "string" || !GOOGLE_ISSUERS.includes(claims.iss)) return { ok: false, reason: "issuer" };

  const aud = claims.aud;
  const audienceOk =
    aud === expected.clientId || (Array.isArray(aud) && aud.includes(expected.clientId) && (aud.length === 1 || claims.azp === expected.clientId));
  if (!audienceOk) return { ok: false, reason: "audience" };

  const nowSeconds = Math.floor(expected.now.getTime() / 1000);
  if (typeof claims.exp !== "number" || claims.exp <= nowSeconds - 30) return { ok: false, reason: "expired" };

  if (typeof claims.nonce !== "string" || !safeEqual(claims.nonce, expected.nonce)) return { ok: false, reason: "nonce" };

  if (typeof claims.sub !== "string" || claims.sub.length === 0 || claims.sub.length > 255) return { ok: false, reason: "subject" };

  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!email || email.length > 255 || !/^[^@\s]+@[^@\s]+$/.test(email)) return { ok: false, reason: "email_missing" };
  // Google atteste que la personne contrôle cette adresse. Sans cela, n'importe qui pourrait se dire propriétaire
  // de l'adresse d'un autre et hériter de son compte.
  if (claims.email_verified !== true && claims.email_verified !== "true") return { ok: false, reason: "email_unverified" };

  const name = typeof claims.name === "string" ? claims.name.trim() : "";
  return { ok: true, profile: { sub: claims.sub, email, ...(name.length >= 2 && name.length <= 80 ? { name } : {}) } };
}
