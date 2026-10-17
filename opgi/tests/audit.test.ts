// Tests d'intégration du journal d'audit : écriture sur action sensible,
// isolation par organisme, accès réservé, et caractère APPEND-ONLY (le rôle
// applicatif ne peut ni modifier ni supprimer une entrée) — vraie base PostgreSQL.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services";
import { handleLogin } from "@/http/auth";
import { handleProjets } from "@/http/projets";
import { handleEntreprises } from "@/http/entreprises";
import { handleMarches, handleSituations, handleSituationDecision } from "@/http/marches";
import { handleAudit } from "@/http/audit";
import { withTenant } from "@/lib/tenant/prisma";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
let s: Services;
const ck = {} as Record<"gest" | "auditeur" | "tech" | "oranAdmin", string>;

beforeAll(async () => {
  s = buildServices({
    DATABASE_URL: requireEnv("TEST_DATABASE_URL"),
    DIRECT_DATABASE_URL: requireEnv("TEST_DIRECT_DATABASE_URL"),
    SESSION_SECRET: "integration-secret-at-least-16",
    ISOLATION_MODE: "shared",
    COOKIE_SECURE: "false",
  });
  ck.gest = await login("OPGI-ALGER", "gest@opgi-alger.demo");
  ck.auditeur = await login("OPGI-ALGER", "auditeur@opgi-alger.demo");
  ck.tech = await login("OPGI-ALGER", "tech@opgi-alger.demo");
  ck.oranAdmin = await login("OPGI-ORAN", "admin@opgi-oran.demo");
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
async function jsonOf<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
async function id(h: (r: Request, s: Services) => Promise<Response>, cookie: string, body: unknown, key: string): Promise<string> {
  const res = await h(req("POST", cookie, body), s);
  if (res.status !== 201) throw new Error(`${key} → ${res.status}`);
  return ((await res.json()) as Record<string, { id: string }>)[key]!.id;
}

describe("journal d'audit", () => {
  it("une action sensible (validation de situation) crée une entrée d'audit", async () => {
    const projetId = await id(handleProjets, ck.gest, { code: "AUD-P", intitule: "Audit" }, "projet");
    const entrepriseId = await id(handleEntreprises, ck.gest, { raisonSociale: "Audit BTP" }, "entreprise");
    const marcheId = await id(
      handleMarches,
      ck.gest,
      { reference: "AUD-M", projetId, entrepriseId, objet: "x", montantCentimes: 1000000 },
      "marche",
    );
    const sitRes = await handleSituations(
      req("POST", ck.gest, { numero: 1, montantTravauxCentimes: 500000, dateDepot: "2026-02-01" }),
      s,
      marcheId,
    );
    const situationId = ((await sitRes.json()) as { situation: { id: string } }).situation.id;

    const dec = await handleSituationDecision(req("POST", ck.gest, { decision: "VALIDEE" }), s, situationId);
    expect(dec.status).toBe(200);

    // Lecture par un rôle autorisé (auditeur) du même organisme.
    const audit = await jsonOf<{ entries: { action: string; objetType: string; utilisateurId: string | null }[] }>(
      await handleAudit(req("GET", ck.auditeur), s),
    );
    const entry = audit.entries.find((e) => e.action === "situation.validee" && e.objetType === "SituationTravaux");
    expect(entry).toBeDefined();
    expect(entry!.utilisateurId).toBeTruthy();
    // marche.create a aussi été audité.
    expect(audit.entries.some((e) => e.action === "marche.create")).toBe(true);
  });

  it("le journal est isolé par organisme (Oran ne voit pas Alger)", async () => {
    const oran = await jsonOf<{ entries: { action: string }[] }>(await handleAudit(req("GET", ck.oranAdmin), s));
    expect(oran.entries.some((e) => e.action === "marche.create")).toBe(false);
  });

  it("l'accès est réservé (un technicien ne peut pas lire le journal : 403)", async () => {
    expect((await handleAudit(req("GET", ck.tech), s)).status).toBe(403);
    // L'auditeur, lui, peut lire.
    expect((await handleAudit(req("GET", ck.auditeur), s)).status).toBe(200);
  });

  it("APPEND-ONLY : le rôle applicatif ne peut ni modifier ni supprimer une entrée", async () => {
    const ctx = { organisationId: (await s.admin.organisation.findFirstOrThrow({ where: { code: "OPGI-ALGER" } })).id, mode: "shared" as const };
    await expect(
      withTenant(s.app, ctx, (tx) => tx.$executeRawUnsafe(`UPDATE "audit_log" SET resume = 'x'`)),
    ).rejects.toThrow();
    await expect(
      withTenant(s.app, ctx, (tx) => tx.$executeRawUnsafe(`DELETE FROM "audit_log"`)),
    ).rejects.toThrow();
  });
});
