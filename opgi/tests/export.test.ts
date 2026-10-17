// Tests d'intégration des exports CSV : contenu, permission « exporter »,
// isolation par organisme, trace d'audit. Plus un test pur du sérialiseur CSV.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services";
import { handleLogin } from "@/http/auth";
import { handleExport } from "@/http/export";
import { handleBiens } from "@/http/patrimoine";
import { handleAudit } from "@/http/audit";
import { toCsv } from "@/lib/export/csv.js";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

describe("toCsv", () => {
  it("échappe les virgules, guillemets et sauts de ligne", () => {
    const out = toCsv(["a", "b"], [["x,y", 'il dit "oui"'], ["ligne\n2", 3]]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toContain('"x,y","il dit ""oui"""');
    expect(out).toContain('"ligne\n2",3');
  });
});

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
let s: Services;
const ck = {} as Record<"agent" | "recouv" | "auditeur" | "oran", string>;

beforeAll(async () => {
  s = buildServices({
    DATABASE_URL: requireEnv("TEST_DATABASE_URL"),
    DIRECT_DATABASE_URL: requireEnv("TEST_DIRECT_DATABASE_URL"),
    SESSION_SECRET: "integration-secret-at-least-16",
    ISOLATION_MODE: "shared",
    COOKIE_SECURE: "false",
  });
  ck.agent = await login("OPGI-ALGER", "agent@opgi-alger.demo");
  ck.recouv = await login("OPGI-ALGER", "recouv@opgi-alger.demo");
  ck.auditeur = await login("OPGI-ALGER", "auditeur@opgi-alger.demo");
  // Admin d'Oran : dispose du droit « exporter » → l'export s'exécute vraiment,
  // ce qui prouve l'isolation (CSV sans le bien d'Alger), non un simple 403.
  ck.oran = await login("OPGI-ORAN", "admin@opgi-oran.demo");
  // Un bien connu côté Alger pour le contenu de l'export.
  await handleBiens(req("POST", ck.agent, { code: "EXP-B1", type: "LOGEMENT", adresse: "Rue Export" }), s);
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
function exportReq(cookie: string, type: string): Request {
  return new Request(`${ORIGIN}/api/export?type=${type}`, { headers: { host: HOST, cookie } });
}

describe("export CSV", () => {
  it("un rôle avec « exporter » télécharge un CSV des biens (en-tête + ligne connue)", async () => {
    const res = await handleExport(exportReq(ck.recouv, "biens"), s);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("biens.csv");
    const csv = await res.text();
    expect(csv).toContain("code,type,etatOccupation,adresse");
    expect(csv).toContain("EXP-B1");
  });

  it("refuse un type inconnu (400)", async () => {
    expect((await handleExport(exportReq(ck.recouv, "xyz"), s)).status).toBe(400);
  });

  it("refuse un rôle sans le droit « exporter » (AGENT_LOCATIF → 403)", async () => {
    expect((await handleExport(exportReq(ck.agent, "biens"), s)).status).toBe(403);
  });

  it("isolation : l'export d'Oran ne contient pas le bien d'Alger", async () => {
    const csv = await (await handleExport(exportReq(ck.oran, "biens"), s)).text();
    expect(csv).not.toContain("EXP-B1");
  });

  it("l'export est tracé au journal d'audit", async () => {
    await handleExport(exportReq(ck.recouv, "contrats"), s);
    const audit = await (await handleAudit(req("GET", ck.auditeur), s)).json();
    const actions = (audit as { entries: { action: string }[] }).entries.map((e) => e.action);
    expect(actions).toContain("export.biens");
    expect(actions).toContain("export.contrats");
  });
});
