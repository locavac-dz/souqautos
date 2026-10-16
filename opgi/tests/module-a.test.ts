// Tests d'intégration du Module A : CRUD biens/occupants/contrats, isolation,
// autorisations et validation — contre une vraie base PostgreSQL.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services";
import { handleLogin } from "@/http/auth";
import { handleBiens, handleBien } from "@/http/patrimoine";
import { handleOccupants } from "@/http/occupants";
import { handleContrats } from "@/http/contrats";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
let s: Services;
let cookieAlger = "";
let cookieOran = "";
let cookieAuditeur = "";

beforeAll(async () => {
  s = buildServices({
    DATABASE_URL: requireEnv("TEST_DATABASE_URL"),
    DIRECT_DATABASE_URL: requireEnv("TEST_DIRECT_DATABASE_URL"),
    SESSION_SECRET: "integration-secret-at-least-16",
    ISOLATION_MODE: "shared",
    COOKIE_SECURE: "false",
  });
  cookieAlger = await login("OPGI-ALGER", "agent@opgi-alger.demo");
  cookieOran = await login("OPGI-ORAN", "agent@opgi-oran.demo");
  cookieAuditeur = await login("OPGI-ALGER", "auditeur@opgi-alger.demo");
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
  if (res.status !== 200) throw new Error(`login ${email} → ${res.status}`);
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

function req(method: string, cookie: string, body?: unknown): Request {
  const headers: Record<string, string> = { origin: ORIGIN, host: HOST, cookie };
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`${ORIGIN}/api/x`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("Bien — CRUD", () => {
  it("crée, lit, met à jour puis archive un bien", async () => {
    const create = await handleBiens(
      req("POST", cookieAlger, { code: "ALG-T-001", type: "LOGEMENT", adresse: "Rue A" }),
      s,
    );
    expect(create.status).toBe(201);
    const { bien } = (await create.json()) as { bien: { id: string; code: string } };
    expect(bien.code).toBe("ALG-T-001");

    const get = await handleBien(req("GET", cookieAlger), s, bien.id);
    expect(get.status).toBe(200);

    const patch = await handleBien(req("PATCH", cookieAlger, { adresse: "Rue B" }), s, bien.id);
    expect(patch.status).toBe(200);
    expect(((await patch.json()) as { bien: { adresse: string } }).bien.adresse).toBe("Rue B");

    const del = await handleBien(req("DELETE", cookieAlger), s, bien.id);
    expect(del.status).toBe(200);

    // Archivé → absent de la liste par défaut, présent avec ?archives=1.
    const list = await handleBiens(req("GET", cookieAlger), s);
    const codes = ((await list.json()) as { biens: { code: string }[] }).biens.map((b) => b.code);
    expect(codes).not.toContain("ALG-T-001");
  });

  it("refuse un code déjà utilisé (409)", async () => {
    await handleBiens(req("POST", cookieAlger, { code: "ALG-DUP", type: "GARAGE" }), s);
    const dup = await handleBiens(req("POST", cookieAlger, { code: "ALG-DUP", type: "GARAGE" }), s);
    expect(dup.status).toBe(409);
  });

  it("refuse des données invalides (400)", async () => {
    const res = await handleBiens(req("POST", cookieAlger, { code: "", type: "INCONNU" }), s);
    expect(res.status).toBe(400);
  });
});

describe("Bien — autorisations", () => {
  it("un AUDITEUR peut lire mais pas créer (403)", async () => {
    expect((await handleBiens(req("GET", cookieAuditeur), s)).status).toBe(200);
    const create = await handleBiens(
      req("POST", cookieAuditeur, { code: "ALG-AUD", type: "AUTRE" }),
      s,
    );
    expect(create.status).toBe(403);
  });
});

describe("Bien — isolation inter‑organisme", () => {
  it("un bien d'Alger est introuvable (404) pour un agent d'Oran", async () => {
    const create = await handleBiens(req("POST", cookieAlger, { code: "ALG-ISO", type: "AUTRE" }), s);
    const { bien } = (await create.json()) as { bien: { id: string } };
    const vol = await handleBien(req("GET", cookieOran), s, bien.id);
    expect(vol.status).toBe(404);
    // …et impossible à modifier depuis Oran.
    const patch = await handleBien(req("PATCH", cookieOran, { adresse: "x" }), s, bien.id);
    expect(patch.status).toBe(404);
  });
});

describe("Occupant & Contrat", () => {
  it("crée un occupant, puis un contrat liant bien + occupant du même organisme", async () => {
    const b = await handleBiens(req("POST", cookieAlger, { code: "ALG-C-001", type: "LOGEMENT" }), s);
    const bienId = ((await b.json()) as { bien: { id: string } }).bien.id;
    const o = await handleOccupants(req("POST", cookieAlger, { nom: "Benali", prenom: "Karim" }), s);
    expect(o.status).toBe(201);
    const occupantId = ((await o.json()) as { occupant: { id: string } }).occupant.id;

    const c = await handleContrats(
      req("POST", cookieAlger, {
        reference: "CT-ALG-001",
        bienId,
        occupantId,
        dateDebut: "2026-01-01",
        montantLoyerCentimes: 1500000,
      }),
      s,
    );
    expect(c.status).toBe(201);
    const { contrat } = (await c.json()) as { contrat: { statut: string; montantLoyerCentimes: number } };
    expect(contrat.statut).toBe("BROUILLON");
    expect(contrat.montantLoyerCentimes).toBe(1500000);
  });

  it("refuse un contrat référençant un bien d'un AUTRE organisme (400, pas de lien croisé)", async () => {
    // Bien d'Alger…
    const b = await handleBiens(req("POST", cookieAlger, { code: "ALG-X-001", type: "AUTRE" }), s);
    const bienAlger = ((await b.json()) as { bien: { id: string } }).bien.id;
    // …occupant d'Oran.
    const o = await handleOccupants(req("POST", cookieOran, { nom: "Oranais" }), s);
    const occupantOran = ((await o.json()) as { occupant: { id: string } }).occupant.id;

    // Depuis Oran, on tente de lier le bien d'Alger : invisible dans le tenant Oran → 400.
    const c = await handleContrats(
      req("POST", cookieOran, {
        reference: "CT-FRAUDE",
        bienId: bienAlger,
        occupantId: occupantOran,
        dateDebut: "2026-01-01",
      }),
      s,
    );
    expect(c.status).toBe(400);
  });

  it("refuse une période incohérente (dateFin < dateDebut) → 400", async () => {
    const c = await handleContrats(
      req("POST", cookieAlger, {
        reference: "CT-BADDATE",
        bienId: "peu-importe",
        occupantId: "peu-importe",
        dateDebut: "2026-06-01",
        dateFin: "2026-01-01",
      }),
      s,
    );
    expect(c.status).toBe(400);
  });
});
