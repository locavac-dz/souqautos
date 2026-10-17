// Tests d'intégration de l'état de compte d'un contrat : totaux consolidés
// (appelé/imputé/solde/paiements/avance), export PDF, isolation inter-OPGI.
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
  handleEtatCompte,
  handleEtatComptePdf,
} from "@/http/finances";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
let s: Services;
let alger = "";
let oran = "";
let contratId = "";

beforeAll(async () => {
  s = buildServices({
    DATABASE_URL: requireEnv("TEST_DATABASE_URL"),
    DIRECT_DATABASE_URL: requireEnv("TEST_DIRECT_DATABASE_URL"),
    SESSION_SECRET: "integration-secret-at-least-16",
    ISOLATION_MODE: "shared",
    COOKIE_SECURE: "false",
  });
  alger = await login("OPGI-ALGER", "agent@opgi-alger.demo");
  oran = await login("OPGI-ORAN", "agent@opgi-oran.demo");

  const bienId = await createId(handleBiens, alger, { code: "EC-B1", type: "LOGEMENT" }, "bien");
  const occId = await createId(handleOccupants, alger, { nom: "Loc EC" }, "occupant");
  contratId = await createId(
    handleContrats,
    alger,
    { reference: "EC-CT-1", bienId, occupantId: occId, statut: "ACTIF", dateDebut: "2026-01-01", montantLoyerCentimes: 100000 },
    "contrat",
  );
  // Deux appels de 100000, un paiement de 60000 imputé à hauteur de 60000 sur A1.
  const a1 = await createId(
    handleAppels,
    alger,
    { contratId, periode: "EC-01", montantCentimes: 100000, dateEcheance: "2026-01-05" },
    "appel",
  );
  await createId(
    handleAppels,
    alger,
    { contratId, periode: "EC-02", montantCentimes: 100000, dateEcheance: "2026-02-05" },
    "appel",
  );
  const p1 = await createId(
    handlePaiements,
    alger,
    { contratId, montantCentimes: 60000, datePaiement: "2026-01-10" },
    "paiement",
  );
  const imp = await handleImputations(req("/api/imputations", "POST", alger, { paiementId: p1, appelId: a1, montantCentimes: 60000 }), s);
  if (imp.status !== 201) throw new Error(`imputation → ${imp.status}`);
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
type Handler = (r: Request, s: Services) => Promise<Response>;
async function createId(h: Handler, cookie: string, body: unknown, key: string): Promise<string> {
  const res = await h(req("/api/x", "POST", cookie, body), s);
  if (res.status !== 201) throw new Error(`${key} création → ${res.status}`);
  return ((await res.json()) as Record<string, { id: string }>)[key]!.id;
}

interface Etat {
  contrat: { reference: string; bienCode: string; occupantNom: string; montantLoyerCentimes: number | null };
  nbAppels: number;
  nbPaiements: number;
  totalAppeleCentimes: number;
  totalImputeCentimes: number;
  soldeDuCentimes: number;
  totalPaiementsCentimes: number;
  avanceCentimes: number;
}

describe("état de compte d'un contrat", () => {
  it("consolide les totaux (appelé, imputé, solde, paiements, avance)", async () => {
    const res = await handleEtatCompte(req(`/api/contrats/${contratId}/etat-compte`, "GET", alger), s, contratId);
    expect(res.status).toBe(200);
    const { etat } = (await res.json()) as { etat: Etat };
    expect(etat.contrat.reference).toBe("EC-CT-1");
    expect(etat.nbAppels).toBe(2);
    expect(etat.nbPaiements).toBe(1);
    expect(etat.totalAppeleCentimes).toBe(200000);
    expect(etat.totalImputeCentimes).toBe(60000);
    expect(etat.soldeDuCentimes).toBe(140000);
    expect(etat.totalPaiementsCentimes).toBe(60000);
    expect(etat.avanceCentimes).toBe(0);
  });

  it("exporte l'état de compte en PDF", async () => {
    const res = await handleEtatComptePdf(req(`/api/contrats/${contratId}/etat-compte/pdf`, "GET", alger), s, contratId);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(200);
  });

  it("isole les organismes : Oran ne voit pas le contrat d'Alger (404)", async () => {
    const res = await handleEtatCompte(req(`/api/contrats/${contratId}/etat-compte`, "GET", oran), s, contratId);
    expect(res.status).toBe(404);
    const pdf = await handleEtatComptePdf(req(`/api/contrats/${contratId}/etat-compte/pdf`, "GET", oran), s, contratId);
    expect(pdf.status).toBe(404);
  });
});
