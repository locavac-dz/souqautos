// Tests d'intégration des bâtiments (hiérarchie du patrimoine) : CRUD,
// rattachement à un site contrôlé dans le tenant, rattachement d'un bien,
// isolation inter-OPGI.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services.js";
import { handleLogin } from "@/http/auth.js";
import { handleSites } from "@/http/sites.js";
import { handleBatiments, handleBatiment } from "@/http/batiments.js";
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

describe("bâtiments (hiérarchie du patrimoine)", () => {
  it("création d'un bâtiment sous un site, rattachement d'un bien, isolation inter-OPGI", async () => {
    const alger = await login("OPGI-ALGER", "agent@opgi-alger.demo");
    const oran = await login("OPGI-ORAN", "agent@opgi-oran.demo");

    // Créer un site puis un bâtiment rattaché à ce site (Alger).
    const site = await jsonOf<{ site: { id: string } }>(
      await handleSites(req("/api/sites", "POST", alger, { code: "CITE-BAT", nom: "Cité Bât" }), s),
    );
    const bat = await jsonOf<{ batiment: { id: string; code: string; siteId: string } }>(
      await handleBatiments(
        req("/api/batiments", "POST", alger, { siteId: site.site.id, code: "BAT-A", nom: "Bâtiment A" }),
        s,
      ),
    );
    expect(bat.batiment.code).toBe("BAT-A");
    expect(bat.batiment.siteId).toBe(site.site.id);

    // Rattacher un bien à ce bâtiment (référence valide dans le tenant).
    const bien = await handleBiens(
      req("/api/biens", "POST", alger, { code: "ALG-BAT-1", type: "LOGEMENT", batimentId: bat.batiment.id }),
      s,
    );
    expect(bien.status).toBe(201);

    // Oran ne voit pas le bâtiment d'Alger.
    const batsOran = await jsonOf<{ batiments: { id: string }[] }>(
      await handleBatiments(req("/api/batiments", "GET", oran), s),
    );
    expect(batsOran.batiments.some((x) => x.id === bat.batiment.id)).toBe(false);

    // Oran ne peut pas rattacher un bien au bâtiment d'Alger (référence invalide → 400).
    const refuse = await handleBiens(
      req("/api/biens", "POST", oran, { code: "ORN-BAT-X", type: "LOGEMENT", batimentId: bat.batiment.id }),
      s,
    );
    expect(refuse.status).toBe(400);

    // Oran ne peut pas lire le bâtiment d'Alger par id (404).
    expect((await handleBatiment(req(`/api/batiments/${bat.batiment.id}`, "GET", oran), s, bat.batiment.id)).status).toBe(
      404,
    );
  });

  it("un bâtiment ne peut pas référencer un site d'un autre organisme (400)", async () => {
    const alger = await login("OPGI-ALGER", "agent@opgi-alger.demo");
    const oran = await login("OPGI-ORAN", "agent@opgi-oran.demo");

    // Site créé côté Alger.
    const site = await jsonOf<{ site: { id: string } }>(
      await handleSites(req("/api/sites", "POST", alger, { code: "CITE-X-ORG", nom: "Cité X-Org" }), s),
    );
    // Oran tente de créer un bâtiment pointant vers le site d'Alger → 400.
    const res = await handleBatiments(
      req("/api/batiments", "POST", oran, { siteId: site.site.id, code: "BAT-ORN-X", nom: "X" }),
      s,
    );
    expect(res.status).toBe(400);
  });

  it("un rôle sans droit de création (AUDITEUR) est refusé (403)", async () => {
    const auditeur = await login("OPGI-ALGER", "auditeur@opgi-alger.demo");
    const res = await handleBatiments(req("/api/batiments", "POST", auditeur, { siteId: "x", code: "X", nom: "Y" }), s);
    expect(res.status).toBe(403);
  });
});
