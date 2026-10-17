// Tests d'intégration de la révocation de session (déconnexion globale +
// invalidation des autres sessions au changement de mot de passe).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services.js";
import { handleLogin } from "@/http/auth.js";
import { handle2faStatut, handleChangePassword, handleRevoquerSessions } from "@/http/compte.js";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
const EMAIL = "revoke@opgi-alger.demo";
let s: Services;

beforeAll(() => {
  s = buildServices({
    DATABASE_URL: requireEnv("TEST_DATABASE_URL"),
    DIRECT_DATABASE_URL: requireEnv("TEST_DIRECT_DATABASE_URL"),
    SESSION_SECRET: "integration-secret-at-least-16",
    ISOLATION_MODE: "shared",
    COOKIE_SECURE: "false",
    PASSWORD_MIN_LENGTH: "12",
  });
});
afterAll(async () => {
  await s.app.$disconnect();
  await s.admin.$disconnect();
});

async function login(password = DEMO_PASSWORD): Promise<string> {
  const res = await handleLogin(
    new Request(`${ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { origin: ORIGIN, host: HOST, "content-type": "application/json" },
      body: JSON.stringify({ code: "OPGI-ALGER", email: EMAIL, password }),
    }),
    s,
  );
  expect(res.status).toBe(200);
  return res.headers.get("set-cookie")!.split(";")[0]!;
}
function cookieFrom(res: Response): string {
  return res.headers.get("set-cookie")!.split(";")[0]!;
}
/** Appel authentifié (statut 2FA) pour tester la validité d'un cookie. */
function ping(cookie: string): Promise<Response> {
  return handle2faStatut(new Request(`${ORIGIN}/api/compte/2fa`, { headers: { cookie } }), s);
}
function postReq(path: string, cookie: string, body?: unknown): Request {
  const headers: Record<string, string> = { origin: ORIGIN, host: HOST, cookie };
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`${ORIGIN}${path}`, {
    method: path.includes("motdepasse") ? "PATCH" : "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("révocation de session", () => {
  it("déconnexion globale invalide le cookie courant ; une reconnexion refonctionne", async () => {
    const cookie = await login();
    expect((await ping(cookie)).status).toBe(200);

    const res = await handleRevoquerSessions(postReq("/api/compte/sessions/revoquer", cookie), s);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("=;"); // cookie effacé

    // L'ancien cookie est désormais rejeté (epoch obsolète).
    expect((await ping(cookie)).status).toBe(401);
    // Une reconnexion redonne un cookie valide.
    expect((await ping(await login())).status).toBe(200);
  });

  it("changement de mot de passe : les AUTRES sessions tombent, la courante est ré-émise", async () => {
    const NOUVEAU = "MotDePasseRevoke-2026!";
    const sessionA = await login(); // session « autre »
    const sessionB = await login(); // session qui changera le mot de passe
    expect((await ping(sessionA)).status).toBe(200);

    const chg = await handleChangePassword(
      postReq("/api/compte/motdepasse", sessionB, { ancien: DEMO_PASSWORD, nouveau: NOUVEAU }),
      s,
    );
    expect(chg.status).toBe(200);
    const sessionBReissue = cookieFrom(chg); // cookie ré-émis (nouvel epoch)

    // L'autre session est invalidée.
    expect((await ping(sessionA)).status).toBe(401);
    // La session courante ré-émise reste valide.
    expect((await ping(sessionBReissue)).status).toBe(200);
    // L'ancien mot de passe ne fonctionne plus ; le nouveau oui.
    expect((await ping(await login(NOUVEAU))).status).toBe(200);
  });
});
