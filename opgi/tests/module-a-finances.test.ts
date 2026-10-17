// Tests d'intégration des finances du Module A : appels, paiements, imputations
// (règles d'intégrité), recouvrement — contre une vraie base PostgreSQL.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services";
import { handleLogin } from "@/http/auth";
import { handleBiens } from "@/http/patrimoine";
import { handleOccupants } from "@/http/occupants";
import { handleContrats } from "@/http/contrats";
import {
  handleAppels,
  handlePaiements,
  handleImputations,
  handleImpayes,
  handleActionsRecouvrement,
} from "@/http/finances";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
let s: Services;
let cookieAlger = "";
let cookieOran = "";
let cookieAuditeur = "";
let contratId = "";
let contrat2Id = "";

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

  const bienId = await createId(handleBiens, cookieAlger, { code: "FIN-B1", type: "LOGEMENT" }, "bien");
  const occId = await createId(handleOccupants, cookieAlger, { nom: "Payeur" }, "occupant");
  contratId = await createId(
    handleContrats,
    cookieAlger,
    { reference: "FIN-CT-1", bienId, occupantId: occId, dateDebut: "2026-01-01", montantLoyerCentimes: 100000 },
    "contrat",
  );
  contrat2Id = await createId(
    handleContrats,
    cookieAlger,
    { reference: "FIN-CT-2", bienId, occupantId: occId, dateDebut: "2026-01-01", montantLoyerCentimes: 50000 },
    "contrat",
  );
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

function req(method: string, cookie: string, body?: unknown): Request {
  const headers: Record<string, string> = { origin: ORIGIN, host: HOST, cookie };
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`${ORIGIN}/api/x`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

type Handler = (r: Request, s: Services) => Promise<Response>;
async function createId(h: Handler, cookie: string, body: unknown, key: string): Promise<string> {
  const res = await h(req("POST", cookie, body), s);
  if (res.status !== 201) throw new Error(`${key} création → ${res.status}`);
  return ((await res.json()) as Record<string, { id: string }>)[key]!.id;
}

describe("Appels & paiements", () => {
  it("crée un appel (montant par défaut = loyer du contrat)", async () => {
    const res = await handleAppels(
      req("POST", cookieAlger, { contratId, periode: "2026-01", dateEcheance: "2026-01-05" }),
      s,
    );
    expect(res.status).toBe(201);
    expect(((await res.json()) as { appel: { montantCentimes: number } }).appel.montantCentimes).toBe(100000);
  });

  it("refuse un appel sur un contrat d'un autre organisme (400)", async () => {
    const res = await handleAppels(
      req("POST", cookieOran, { contratId, periode: "2026-01", dateEcheance: "2026-01-05" }),
      s,
    );
    expect(res.status).toBe(400);
  });

  it("un AUDITEUR ne peut pas enregistrer un paiement (403)", async () => {
    const res = await handlePaiements(
      req("POST", cookieAuditeur, { contratId, montantCentimes: 1000, datePaiement: "2026-01-10" }),
      s,
    );
    expect(res.status).toBe(403);
  });
});

describe("Imputations — règles d'intégrité", () => {
  it("impute un paiement sur un appel et met à jour les soldes", async () => {
    const appelId = await createId(
      handleAppels,
      cookieAlger,
      { contratId, periode: "2026-02", montantCentimes: 100000, dateEcheance: "2026-02-05" },
      "appel",
    );
    const paiementId = await createId(
      handlePaiements,
      cookieAlger,
      { contratId, montantCentimes: 60000, datePaiement: "2026-02-10" },
      "paiement",
    );
    const imp = await handleImputations(req("POST", cookieAlger, { paiementId, appelId, montantCentimes: 60000 }), s);
    expect(imp.status).toBe(201);

    // Solde appel = 100000 - 60000 = 40000 ; reste paiement = 0.
    const appels = (await (await handleAppels(req("GET", cookieAlger) , s)).json()) as {
      appels: { id: string; soldeCentimes: number }[];
    };
    expect(appels.appels.find((a) => a.id === appelId)!.soldeCentimes).toBe(40000);
    const paiements = (await (await handlePaiements(req("GET", cookieAlger), s)).json()) as {
      paiements: { id: string; resteCentimes: number }[];
    };
    expect(paiements.paiements.find((p) => p.id === paiementId)!.resteCentimes).toBe(0);
  });

  it("refuse une imputation dépassant le solde de l'appel (409)", async () => {
    const appelId = await createId(
      handleAppels,
      cookieAlger,
      { contratId, periode: "2026-03", montantCentimes: 10000, dateEcheance: "2026-03-05" },
      "appel",
    );
    const paiementId = await createId(
      handlePaiements,
      cookieAlger,
      { contratId, montantCentimes: 99999, datePaiement: "2026-03-10" },
      "paiement",
    );
    const imp = await handleImputations(req("POST", cookieAlger, { paiementId, appelId, montantCentimes: 10001 }), s);
    expect(imp.status).toBe(409);
  });

  it("refuse une imputation dépassant le reste du paiement (409)", async () => {
    const appelId = await createId(
      handleAppels,
      cookieAlger,
      { contratId, periode: "2026-04", montantCentimes: 100000, dateEcheance: "2026-04-05" },
      "appel",
    );
    const paiementId = await createId(
      handlePaiements,
      cookieAlger,
      { contratId, montantCentimes: 5000, datePaiement: "2026-04-10" },
      "paiement",
    );
    const imp = await handleImputations(req("POST", cookieAlger, { paiementId, appelId, montantCentimes: 6000 }), s);
    expect(imp.status).toBe(409);
  });

  it("refuse d'imputer un paiement sur un appel d'un AUTRE contrat (409)", async () => {
    const appel2 = await createId(
      handleAppels,
      cookieAlger,
      { contratId: contrat2Id, periode: "2026-01", montantCentimes: 50000, dateEcheance: "2026-01-05" },
      "appel",
    );
    const paiement1 = await createId(
      handlePaiements,
      cookieAlger,
      { contratId, montantCentimes: 50000, datePaiement: "2026-01-10" },
      "paiement",
    );
    const imp = await handleImputations(req("POST", cookieAlger, { paiementId: paiement1, appelId: appel2, montantCentimes: 10000 }), s);
    expect(imp.status).toBe(409);
  });

  it("empêche un autre organisme d'imputer sur des entités d'Alger (400)", async () => {
    const appelId = await createId(
      handleAppels,
      cookieAlger,
      { contratId, periode: "2026-05", montantCentimes: 100000, dateEcheance: "2026-05-05" },
      "appel",
    );
    const paiementId = await createId(
      handlePaiements,
      cookieAlger,
      { contratId, montantCentimes: 100000, datePaiement: "2026-05-10" },
      "paiement",
    );
    const imp = await handleImputations(req("POST", cookieOran, { paiementId, appelId, montantCentimes: 1000 }), s);
    expect(imp.status).toBe(400);
  });
});

describe("Recouvrement", () => {
  it("liste les impayés (appels avec solde > 0) et enregistre une action", async () => {
    // L'appel 2026-02 a un solde de 40000 (cf. test ci-dessus) → impayé.
    const res = await handleImpayes(req("GET", cookieAlger), s);
    expect(res.status).toBe(200);
    const { impayes } = (await res.json()) as {
      impayes: { soldeCentimes: number; contratReference: string; joursRetard: number }[];
    };
    expect(impayes.length).toBeGreaterThan(0);
    expect(impayes.every((i) => i.soldeCentimes > 0)).toBe(true);

    const action = await handleActionsRecouvrement(
      req("POST", cookieAlger, { contratId, type: "RELANCE", date: "2026-06-01", note: "1re relance" }),
      s,
    );
    expect(action.status).toBe(201);

    const list = await handleActionsRecouvrement(req("GET", cookieAlger), s);
    const { actions } = (await list.json()) as { actions: { type: string }[] };
    expect(actions.some((a) => a.type === "RELANCE")).toBe(true);
  });

  it("isole le recouvrement : Oran ne voit pas les actions d'Alger", async () => {
    const list = await handleActionsRecouvrement(req("GET", cookieOran), s);
    const { actions } = (await list.json()) as { actions: unknown[] };
    expect(actions).toHaveLength(0);
  });
});
