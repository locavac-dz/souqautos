// Tests d'intégration des sites (hiérarchie du patrimoine) : CRUD, isolation,
// rattachement d'un bien contrôlé dans le tenant.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services.js";
import { handleLogin } from "@/http/auth.js";
import { handleSites, handleSite } from "@/http/sites.js";
import { handleBiens } from "@/http/patrimoine.js";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
let s: Services;

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

async function login(code: string, email: string): Promise<string> {
  const res = await handleLogin(
    new Request(`${ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { origin: ORIGIN, host: HOST, "content-type": "application/json" },
      body: JSON.stringify({ code, email, password: DEMO_PASSWORD }),
    }),
    s,
  );
  return res.headers.get("set-cookie")!.split(";")[0]!;
}
function req(path: string, method: string, cookie: string, body?: unknown): Request {
  const headers: Record<string, string> = { origin: ORIGIN, host: HOST, cookie };
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
async function jsonOf<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

describe("sites (hiérarchie du patrimoine)", () => {
  it("création d'un site, rattachement d'un bien, isolation inter-OPGI", async () => {
    const alger = await login("OPGI-ALGER", "agent@opgi-alger.demo");
    const oran = await login("OPGI-ORAN", "agent@opgi-oran.demo");

    // Créer un site à Alger.
    const site = await jsonOf<{ site: { id: string; code: string } }>(
      await handleSites(req("/api/sites", "POST", alger, { code: "CITE-TEST", nom: "Cité Test" }), s),
    );
    expect(site.site.code).toBe("CITE-TEST");

    // Rattacher un bien à ce site (référence valide dans le tenant).
    const bien = await handleBiens(
      req("/api/biens", "POST", alger, { code: "ALG-SITE-1", type: "LOGEMENT", siteId: site.site.id }),
      s,
    );
    expect(bien.status).toBe(201);

    // Oran ne voit pas le site d'Alger.
    const sitesOran = await jsonOf<{ sites: { id: string }[] }>(
      await handleSites(req("/api/sites", "GET", oran), s),
    );
    expect(sitesOran.sites.some((x) => x.id === site.site.id)).toBe(false);

    // Oran ne peut pas rattacher un bien au site d'Alger (référence invalide → 400).
    const refuse = await handleBiens(
      req("/api/biens", "POST", oran, { code: "ORN-SITE-X", type: "LOGEMENT", siteId: site.site.id }),
      s,
    );
    expect(refuse.status).toBe(400);

    // Oran ne peut pas lire le site d'Alger par id (404).
    expect((await handleSite(req(`/api/sites/${site.site.id}`, "GET", oran), s, site.site.id)).status).toBe(404);
  });

  it("un rôle sans droit de création (AUDITEUR) est refusé (403)", async () => {
    const auditeur = await login("OPGI-ALGER", "auditeur@opgi-alger.demo");
    const res = await handleSites(req("/api/sites", "POST", auditeur, { code: "X", nom: "Y" }), s);
    expect(res.status).toBe(403);
  });
});
