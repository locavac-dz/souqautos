// Lot 132 — FAUX serveur Google pour les tests de bout en bout de « Continuer avec Google ». Il remplace uniquement
// les deux adresses de Google (page de choix du compte, échange du code) ; tout le reste — cookie de déroulement,
// état, nonce, PKCE, création du compte, session — est le vrai code du site.
//
// Il ne « laisse pas passer » : comme Google, il REFUSE une demande mal formée (paramètre manquant, mauvais secret,
// code déjà utilisé ou inconnu, adresse de retour différente, vérificateur PKCE qui ne correspond pas à l'empreinte).
// Un test qui réussit prouve donc que le site envoie une demande correcte.
//
// Démarré par Playwright (playwright.config.ts) sur le port 5187, avec des identifiants FACTICES (aucun vrai secret).
//   POST /__control   { identity?, behavior? }  choisit qui « se connecte » et comment Google répond
//   GET  /__state                                nombre d'échanges de code reçus
//   GET  /auth, POST /token                     les deux points de Google

import http from "node:http";
import { createHash, randomBytes } from "node:crypto";

const PORT = 5187;
const CLIENT_ID = "e2e-client.apps.googleusercontent.com";
const CLIENT_SECRET = "e2e-secret-factice";

const DEFAULT_IDENTITY = { sub: "google-sub-defaut", email: "defaut@example.dz", email_verified: true, name: "Personne Google" };
let identity = { ...DEFAULT_IDENTITY };
let behavior = "ok"; // ok | cancel | error | wrong_nonce | expired | wrong_issuer | wrong_audience | bad_token
const issued = new Map();
let exchanges = 0;

const b64 = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
  res.end(body === undefined ? undefined : JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve) => {
  let data = "";
  req.on("data", (chunk) => (data += chunk));
  req.on("end", () => resolve(data));
});

function idToken(claims) {
  return `${b64({ alg: "RS256", typ: "JWT", kid: "mock" })}.${b64(claims)}.${b64("signature-factice")}`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/__health") return send(res, 200, { ok: true });

  if (req.method === "POST" && url.pathname === "/__control") {
    const body = JSON.parse((await readBody(req)) || "{}");
    // La remise à zéro d'abord : `{ reset: true, identity }` signifie « repartir de zéro PUIS choisir cette identité ».
    if (body.reset) {
      identity = { ...DEFAULT_IDENTITY };
      behavior = "ok";
      exchanges = 0;
    }
    if (body.identity) identity = { ...DEFAULT_IDENTITY, ...body.identity };
    if (body.behavior) behavior = body.behavior;
    return send(res, 204);
  }
  if (req.method === "GET" && url.pathname === "/__state") return send(res, 200, { exchanges });

  // Page de choix du compte : ici, le « choix » est celui de l'identité configurée, sans écran.
  if (req.method === "GET" && url.pathname === "/auth") {
    const q = url.searchParams;
    const problems = [];
    if (q.get("client_id") !== CLIENT_ID) problems.push("client_id");
    if (q.get("response_type") !== "code") problems.push("response_type");
    if (!(q.get("scope") ?? "").split(" ").includes("openid")) problems.push("scope openid");
    if (!(q.get("scope") ?? "").split(" ").includes("email")) problems.push("scope email");
    if (q.get("code_challenge_method") !== "S256") problems.push("code_challenge_method");
    if (!q.get("code_challenge")) problems.push("code_challenge");
    if (!q.get("state")) problems.push("state");
    if (!q.get("nonce")) problems.push("nonce");
    if (!q.get("redirect_uri")?.endsWith("/api/auth/google/callback")) problems.push("redirect_uri");
    if (q.has("client_secret")) problems.push("client_secret ne doit JAMAIS figurer dans l'adresse");
    if (problems.length > 0) return send(res, 400, { error: "invalid_request", problems });

    const redirect = new URL(q.get("redirect_uri"));
    redirect.searchParams.set("state", q.get("state"));
    if (behavior === "cancel") {
      redirect.searchParams.set("error", "access_denied");
    } else if (behavior === "error") {
      redirect.searchParams.set("error", "server_error");
    } else {
      const code = randomBytes(16).toString("base64url");
      issued.set(code, { nonce: q.get("nonce"), challenge: q.get("code_challenge"), redirectUri: q.get("redirect_uri"), identity: { ...identity }, behavior, used: false });
      redirect.searchParams.set("code", code);
    }
    res.writeHead(302, { Location: redirect.toString(), "Cache-Control": "no-store" });
    return res.end();
  }

  // Échange du code, de serveur à serveur.
  if (req.method === "POST" && url.pathname === "/token") {
    exchanges += 1;
    const form = new URLSearchParams(await readBody(req));
    const entry = issued.get(form.get("code") ?? "");
    const invalid = (why) => send(res, 400, { error: "invalid_grant", error_description: why });

    if (form.get("client_id") !== CLIENT_ID || form.get("client_secret") !== CLIENT_SECRET) return send(res, 401, { error: "invalid_client" });
    if (form.get("grant_type") !== "authorization_code") return invalid("grant_type");
    if (!entry) return invalid("code inconnu");
    if (entry.used) return invalid("code déjà utilisé");
    entry.used = true;
    if (form.get("redirect_uri") !== entry.redirectUri) return invalid("redirect_uri");
    // PKCE réel : l'empreinte SHA-256 du vérificateur reçu doit être celle annoncée au départ.
    const verifier = form.get("code_verifier") ?? "";
    if (verifier.length < 43 || createHash("sha256").update(verifier).digest("base64url") !== entry.challenge) return invalid("PKCE");

    const now = Math.floor(Date.now() / 1000);
    const id = entry.identity;
    const claims = {
      iss: entry.behavior === "wrong_issuer" ? "https://faux-emetteur.example" : "https://accounts.google.com",
      aud: entry.behavior === "wrong_audience" ? "un-autre-client" : CLIENT_ID,
      azp: CLIENT_ID,
      sub: id.sub,
      email: id.email,
      email_verified: id.email_verified,
      name: id.name,
      nonce: entry.behavior === "wrong_nonce" ? "nonce-different" : entry.nonce,
      iat: now,
      exp: entry.behavior === "expired" ? now - 3600 : now + 3600,
    };
    const token = entry.behavior === "bad_token" ? "ceci-n-est-pas-un-jeton" : idToken(claims);
    return send(res, 200, { access_token: "jeton-d-acces-factice", token_type: "Bearer", expires_in: 3600, id_token: token });
  }

  send(res, 404, { error: "not_found" });
});

server.listen(PORT, () => console.log(`[faux Google] http://localhost:${PORT}`));
