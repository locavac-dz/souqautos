// Tests d'intégration du portail public de dépôt de réclamation.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services.js";
import { handleDepotPublic } from "@/http/portail.js";
import { loadEnv, requireEnv } from "./_env.js";

loadEnv();

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";

function build(extra: Record<string, string> = {}): Services {
  return buildServices({
    DATABASE_URL: requireEnv("TEST_DATABASE_URL"),
    DIRECT_DATABASE_URL: requireEnv("TEST_DIRECT_DATABASE_URL"),
    SESSION_SECRET: "integration-secret-at-least-16",
    ISOLATION_MODE: "shared",
    COOKIE_SECURE: "false",
    PUBLIC_RL_MAX: "100",
    ...extra,
  });
}

function post(s: Services, body: unknown, opts: { origin?: boolean; ip?: string } = {}): Promise<Response> {
  const headers: Record<string, string> = { host: HOST, "content-type": "application/json" };
  if (opts.origin !== false) headers.origin = ORIGIN;
  if (opts.ip) headers["x-forwarded-for"] = opts.ip;
  return handleDepotPublic(
    new Request(`${ORIGIN}/api/portail/reclamations`, { method: "POST", headers, body: JSON.stringify(body) }),
    s,
  );
}

const VALIDE = { code: "OPGI-ALGER", categorie: "PLOMBERIE", description: "Fuite au 2e étage (public)." };

describe("portail public — dépôt de réclamation", () => {
  let s: Services;
  beforeAll(() => {
    s = build();
  });
  afterAll(async () => {
    await s.app.$disconnect();
    await s.admin.$disconnect();
  });

  it("refuse une origine étrangère (403 CSRF)", async () => {
    const res = await handleDepotPublic(
      new Request(`${ORIGIN}/api/portail/reclamations`, {
        method: "POST",
        headers: { origin: "http://evil.example", host: HOST, "content-type": "application/json" },
        body: JSON.stringify(VALIDE),
      }),
      s,
    );
    expect(res.status).toBe(403);
  });

  it("dépôt valide → 201 + référence, cloisonné sur le bon organisme", async () => {
    const res = await post(s, VALIDE, { ip: "10.0.0.1" });
    expect(res.status).toBe(201);
    const { reference } = (await res.json()) as { reference: string };
    expect(reference).toMatch(/^REC-/);

    // Vérifie (via le rôle propriétaire) l'organisme, le canal et l'absence de déclarant authentifié.
    const alger = await s.admin.organisation.findUniqueOrThrow({ where: { code: "OPGI-ALGER" } });
    const rec = await s.admin.reclamation.findFirstOrThrow({ where: { reference } });
    expect(rec.organisationId).toBe(alger.id);
    expect(rec.declarantUtilisateurId).toBeNull();
    expect(rec.canal).toBe("PORTAIL");
    expect(rec.statut).toBe("NOUVELLE");
    // La réponse n'expose QUE la référence (aucune autre donnée).
    const brut = await (await post(s, VALIDE, { ip: "10.0.0.2" })).json();
    expect(Object.keys(brut as object)).toEqual(["reference"]);
  });

  it("code d'organisme inconnu → 404", async () => {
    const res = await post(s, { ...VALIDE, code: "OPGI-INEXISTANT" }, { ip: "10.0.0.3" });
    expect(res.status).toBe(404);
  });

  it("code manquant (mode partagé) → 400", async () => {
    const { code: _omit, ...sansCode } = VALIDE;
    void _omit;
    const res = await post(s, sansCode, { ip: "10.0.0.4" });
    expect(res.status).toBe(400);
  });

  it("catégorie invalide ou description trop courte → 400", async () => {
    expect((await post(s, { ...VALIDE, categorie: "XXX" }, { ip: "10.0.0.5" })).status).toBe(400);
    expect((await post(s, { ...VALIDE, description: "x" }, { ip: "10.0.0.6" })).status).toBe(400);
  });

  it("limiteur de débit : au-delà du seuil → 429", async () => {
    const s2 = build({ PUBLIC_RL_MAX: "2" });
    try {
      const ip = "203.0.113.9";
      expect((await post(s2, VALIDE, { ip })).status).toBe(201);
      expect((await post(s2, VALIDE, { ip })).status).toBe(201);
      expect((await post(s2, VALIDE, { ip })).status).toBe(429);
      // Une autre IP n'est pas affectée.
      expect((await post(s2, VALIDE, { ip: "203.0.113.10" })).status).toBe(201);
    } finally {
      await s2.app.$disconnect();
      await s2.admin.$disconnect();
    }
  });
});
