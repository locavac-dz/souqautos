// Tests d'intégration de la 2FA (TOTP) : enrôlement, activation, application au
// login, désactivation.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services.js";
import { handleLogin } from "@/http/auth.js";
import {
  handle2faStatut,
  handle2faDebut,
  handle2faActiver,
  handle2faDesactiver,
} from "@/http/compte.js";
import { genererCode } from "@/lib/auth/totp.js";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

let s: Services;
const HOST = "localhost:5184";
const ORIGIN = "http://localhost:5184";
const EMAIL = "totp@opgi-alger.demo";

beforeAll(() => {
  s = buildServices({
    DATABASE_URL: requireEnv("TEST_DATABASE_URL"),
    DIRECT_DATABASE_URL: requireEnv("TEST_DIRECT_DATABASE_URL"),
    SESSION_SECRET: "integration-secret-at-least-16",
    ISOLATION_MODE: "shared",
    COOKIE_SECURE: "false",
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
async function login(body: Record<string, unknown>): Promise<Response> {
  return handleLogin(loginReq({ code: "OPGI-ALGER", email: EMAIL, password: DEMO_PASSWORD, ...body }), s);
}
function cookieFrom(res: Response): string {
  return res.headers.get("set-cookie")!.split(";")[0]!;
}
function post(path: string, cookie: string, body?: unknown, withOrigin = true): Request {
  const headers: Record<string, string> = { host: HOST, cookie, "content-type": "application/json" };
  if (withOrigin) headers.origin = ORIGIN;
  return new Request(`${ORIGIN}${path}`, { method: "POST", headers, body: body ? JSON.stringify(body) : undefined });
}

describe("2FA TOTP (enrôlement → login → désactivation)", () => {
  it("statut initial : inactif", async () => {
    const cookie = cookieFrom(await login({}));
    const res = await handle2faStatut(new Request(`${ORIGIN}/api/compte/2fa`, { headers: { cookie } }), s);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { actif: boolean }).actif).toBe(false);
  });

  it("début d'enrôlement refusé sans origine (403 CSRF)", async () => {
    const cookie = cookieFrom(await login({}));
    const res = await handle2faDebut(post("/api/compte/2fa/debut", cookie, undefined, false), s);
    expect(res.status).toBe(403);
  });

  it("activer avec un mauvais code échoue (400)", async () => {
    const cookie = cookieFrom(await login({}));
    const debut = await handle2faDebut(post("/api/compte/2fa/debut", cookie), s);
    expect(debut.status).toBe(200);
    const res = await handle2faActiver(post("/api/compte/2fa/activer", cookie, { code: "000000" }), s);
    expect(res.status).toBe(400);
  });

  it("flux complet : activer, le login exige alors un code 2FA valide, puis désactiver", async () => {
    // Enrôlement.
    let cookie = cookieFrom(await login({}));
    const debut = await handle2faDebut(post("/api/compte/2fa/debut", cookie), s);
    const { secret } = (await debut.json()) as { secret: string; uri: string };
    expect(secret).toBeTruthy();

    // Activation avec le vrai code.
    const activer = await handle2faActiver(
      post("/api/compte/2fa/activer", cookie, { code: genererCode(secret) }),
      s,
    );
    expect(activer.status).toBe(200);

    // Statut désormais actif.
    const statut = await handle2faStatut(new Request(`${ORIGIN}/api/compte/2fa`, { headers: { cookie } }), s);
    expect(((await statut.json()) as { actif: boolean }).actif).toBe(true);

    // Login SANS code → 401 + twoFactorRequired (mot de passe pourtant correct).
    const sansCode = await login({});
    expect(sansCode.status).toBe(401);
    expect(((await sansCode.json()) as { twoFactorRequired?: boolean }).twoFactorRequired).toBe(true);

    // Login avec mauvais code → 401 générique.
    expect((await login({ code2fa: "000000" })).status).toBe(401);

    // Login avec le bon code → 200.
    const ok = await login({ code2fa: genererCode(secret) });
    expect(ok.status).toBe(200);

    // Désactivation : mauvais mot de passe → 400 ; bon mot de passe → 200.
    cookie = cookieFrom(ok);
    expect(
      (await handle2faDesactiver(post("/api/compte/2fa/desactiver", cookie, { motDePasse: "faux" }), s)).status,
    ).toBe(400);
    const off = await handle2faDesactiver(
      post("/api/compte/2fa/desactiver", cookie, { motDePasse: DEMO_PASSWORD }),
      s,
    );
    expect(off.status).toBe(200);

    // Le login ne demande plus de code.
    expect((await login({})).status).toBe(200);
  });
});
