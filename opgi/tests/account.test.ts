// Tests d'intégration du changement de mot de passe en self-service.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services.js";
import { handleLogin } from "@/http/auth.js";
import { handleChangePassword } from "@/http/compte.js";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

let s: Services;
const HOST = "localhost:5184";
const ORIGIN = "http://localhost:5184";
const NOUVEAU = "NouveauMotDePasse-2026!";

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

function loginReq(body: unknown): Request {
  return new Request(`${ORIGIN}/api/auth/login`, {
    method: "POST",
    headers: { origin: ORIGIN, host: HOST, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function login(email: string, password = DEMO_PASSWORD): Promise<Response> {
  return handleLogin(loginReq({ code: "OPGI-ALGER", email, password }), s);
}

function cookieFrom(res: Response): string {
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

function changeReq(cookie: string, body: unknown, withOrigin = true): Request {
  const headers: Record<string, string> = { host: HOST, cookie, "content-type": "application/json" };
  if (withOrigin) headers.origin = ORIGIN;
  return new Request(`${ORIGIN}/api/compte/motdepasse`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

describe("changement de mot de passe", () => {
  const EMAIL = "mdp@opgi-alger.demo"; // compte dédié (muté par ce test)

  it("refuse sans session (401)", async () => {
    const res = await handleChangePassword(
      new Request(`${ORIGIN}/api/compte/motdepasse`, {
        method: "PATCH",
        headers: { origin: ORIGIN, host: HOST, "content-type": "application/json" },
        body: JSON.stringify({ ancien: DEMO_PASSWORD, nouveau: NOUVEAU }),
      }),
      s,
    );
    expect(res.status).toBe(401);
  });

  it("refuse une origine étrangère (403 CSRF)", async () => {
    const cookie = cookieFrom(await login(EMAIL));
    const req = new Request(`${ORIGIN}/api/compte/motdepasse`, {
      method: "PATCH",
      headers: { origin: "http://evil.example", host: HOST, cookie, "content-type": "application/json" },
      body: JSON.stringify({ ancien: DEMO_PASSWORD, nouveau: NOUVEAU }),
    });
    expect((await handleChangePassword(req, s)).status).toBe(403);
  });

  it("refuse un mot de passe trop court (400)", async () => {
    const cookie = cookieFrom(await login(EMAIL));
    const res = await handleChangePassword(changeReq(cookie, { ancien: DEMO_PASSWORD, nouveau: "court" }), s);
    expect(res.status).toBe(400);
  });

  it("refuse si le nouveau est identique à l'ancien (400)", async () => {
    const cookie = cookieFrom(await login(EMAIL));
    const res = await handleChangePassword(
      changeReq(cookie, { ancien: DEMO_PASSWORD, nouveau: DEMO_PASSWORD }),
      s,
    );
    expect(res.status).toBe(400);
  });

  it("refuse un mauvais mot de passe actuel (400, message générique)", async () => {
    const cookie = cookieFrom(await login(EMAIL));
    const res = await handleChangePassword(changeReq(cookie, { ancien: "mauvais-actuel", nouveau: NOUVEAU }), s);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/actuel/i);
  });

  it("change le mot de passe puis l'ancien ne fonctionne plus, le nouveau oui", async () => {
    const cookie = cookieFrom(await login(EMAIL));
    const res = await handleChangePassword(changeReq(cookie, { ancien: DEMO_PASSWORD, nouveau: NOUVEAU }), s);
    expect(res.status).toBe(200);

    // L'ancien mot de passe est désormais refusé.
    expect((await login(EMAIL, DEMO_PASSWORD)).status).toBe(401);
    // Le nouveau fonctionne.
    expect((await login(EMAIL, NOUVEAU)).status).toBe(200);
  });
});
