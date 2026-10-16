// Tests d'intégration de la couche HTTP : login → cookie → accès isolé + autorisé.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services.js";
import { handleLogin } from "@/http/auth.js";
import { handleBiens as handleListBiens } from "@/http/patrimoine.js";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

let s: Services;
const HOST = "localhost:5184";
const ORIGIN = "http://localhost:5184";

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

function cookieFrom(res: Response): string {
  const setCookie = res.headers.get("set-cookie")!;
  return setCookie.split(";")[0]!; // "opgi_session=<token>"
}

async function login(code: string, email: string, password = DEMO_PASSWORD): Promise<Response> {
  return handleLogin(loginReq({ code, email, password }), s);
}

describe("login", () => {
  it("refuse de mauvais identifiants (401, message générique)", async () => {
    const res = await login("OPGI-ALGER", "agent@opgi-alger.demo", "mauvais");
    expect(res.status).toBe(401);
  });

  it("refuse un code d'OPGI inexistant (401)", async () => {
    const res = await login("OPGI-INEXISTANT", "agent@opgi-alger.demo");
    expect(res.status).toBe(401);
  });

  it("refuse une requête d'origine étrangère (403 CSRF)", async () => {
    const req = new Request(`${ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { origin: "http://evil.example", host: HOST, "content-type": "application/json" },
      body: JSON.stringify({ code: "OPGI-ALGER", email: "agent@opgi-alger.demo", password: DEMO_PASSWORD }),
    });
    expect((await handleLogin(req, s)).status).toBe(403);
  });

  it("accepte de bons identifiants et pose un cookie de session", async () => {
    const res = await login("OPGI-ALGER", "agent@opgi-alger.demo");
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("opgi_session=");
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
  });
});

describe("accès aux biens (session → organisme → autorisation → isolation)", () => {
  it("refuse sans session (401)", async () => {
    const res = await handleListBiens(new Request(`${ORIGIN}/api/biens`), s);
    expect(res.status).toBe(401);
  });

  it("un cookie altéré est rejeté (401)", async () => {
    const req = new Request(`${ORIGIN}/api/biens`, { headers: { cookie: "opgi_session=xxx.yyy.zzz" } });
    expect((await handleListBiens(req, s)).status).toBe(401);
  });

  it("l'agent d'Alger ne voit QUE les biens d'Alger", async () => {
    const cookie = cookieFrom(await login("OPGI-ALGER", "agent@opgi-alger.demo"));
    const res = await handleListBiens(new Request(`${ORIGIN}/api/biens`, { headers: { cookie } }), s);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { biens: { code: string }[] };
    expect(body.biens.length).toBeGreaterThan(0);
    expect(body.biens.every((b) => b.code.startsWith("ALG-"))).toBe(true);
  });

  it("l'agent d'Oran ne voit QUE les biens d'Oran (isolation de bout en bout)", async () => {
    const cookie = cookieFrom(await login("OPGI-ORAN", "agent@opgi-oran.demo"));
    const res = await handleListBiens(new Request(`${ORIGIN}/api/biens`, { headers: { cookie } }), s);
    const body = (await res.json()) as { biens: { code: string }[] };
    expect(body.biens.every((b) => b.code.startsWith("ORN-"))).toBe(true);
  });

  it("un rôle sans droit de lecture sur le module A est refusé (403)", async () => {
    const cookie = cookieFrom(await login("OPGI-ALGER", "chef@opgi-alger.demo")); // CHEF_PROJET
    const res = await handleListBiens(new Request(`${ORIGIN}/api/biens`, { headers: { cookie } }), s);
    expect(res.status).toBe(403);
  });
});
