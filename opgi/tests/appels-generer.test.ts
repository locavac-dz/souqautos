// Tests d'intégration de la génération en masse des appels de loyer :
// un appel par contrat ACTIF au loyer du contrat, idempotence, contrats sans
// loyer / BROUILLON ignorés, isolation inter-OPGI, droit requis.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services";
import { handleLogin } from "@/http/auth";
import { handleBiens } from "@/http/patrimoine";
import { handleOccupants } from "@/http/occupants";
import { handleContrats } from "@/http/contrats";
import { handleAppels, handleAppelsGenerer } from "@/http/finances";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
const PERIODE = "GEN-2099-01"; // période dédiée (jamais utilisée ailleurs).
let s: Services;
let alger = "";
let oran = "";
let auditeur = "";
let ctActif1 = "";
let ctActif2 = "";
let ctSansLoyer = "";
let ctBrouillon = "";

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
  auditeur = await login("OPGI-ALGER", "auditeur@opgi-alger.demo");

  const bienId = await createId(handleBiens, alger, { code: "GEN-B1", type: "LOGEMENT" }, "bien");
  const occId = await createId(handleOccupants, alger, { nom: "Loc Gen" }, "occupant");
  ctActif1 = await createId(
    handleContrats,
    alger,
    { reference: "GEN-CT-A1", bienId, occupantId: occId, statut: "ACTIF", dateDebut: "2026-01-01", montantLoyerCentimes: 70000 },
    "contrat",
  );
  ctActif2 = await createId(
    handleContrats,
    alger,
    { reference: "GEN-CT-A2", bienId, occupantId: occId, statut: "ACTIF", dateDebut: "2026-01-01", montantLoyerCentimes: 80000 },
    "contrat",
  );
  ctSansLoyer = await createId(
    handleContrats,
    alger,
    { reference: "GEN-CT-SANS", bienId, occupantId: occId, statut: "ACTIF", dateDebut: "2026-01-01", montantLoyerCentimes: null },
    "contrat",
  );
  ctBrouillon = await createId(
    handleContrats,
    alger,
    { reference: "GEN-CT-BR", bienId, occupantId: occId, statut: "BROUILLON", dateDebut: "2026-01-01", montantLoyerCentimes: 90000 },
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
async function appelsDuContrat(cookie: string, contratId: string): Promise<{ periode: string; montantCentimes: number }[]> {
  const res = await handleAppels(req(`/api/appels?contrat=${contratId}`, "GET", cookie), s);
  return ((await res.json()) as { appels: { periode: string; montantCentimes: number }[] }).appels;
}

interface Resume {
  periode: string;
  contratsActifs: number;
  crees: number;
  ignoresExistants: number;
  ignoresSansLoyer: number;
}

describe("génération en masse des appels", () => {
  it("génère un appel par contrat ACTIF au loyer du contrat ; ignore sans-loyer et BROUILLON", async () => {
    const res = await handleAppelsGenerer(
      req("/api/appels/generer", "POST", alger, { periode: PERIODE, dateEcheance: "2099-12-31" }),
      s,
    );
    expect(res.status).toBe(201);
    const { resume } = (await res.json()) as { resume: Resume };
    expect(resume.periode).toBe(PERIODE);
    expect(resume.crees).toBeGreaterThanOrEqual(2); // au moins mes deux contrats actifs avec loyer
    expect(resume.ignoresSansLoyer).toBeGreaterThanOrEqual(1); // le contrat actif sans loyer

    // Montant = loyer du contrat.
    const a1 = (await appelsDuContrat(alger, ctActif1)).find((a) => a.periode === PERIODE);
    const a2 = (await appelsDuContrat(alger, ctActif2)).find((a) => a.periode === PERIODE);
    expect(a1?.montantCentimes).toBe(70000);
    expect(a2?.montantCentimes).toBe(80000);

    // Ni le contrat sans loyer ni le BROUILLON n'ont d'appel.
    expect((await appelsDuContrat(alger, ctSansLoyer)).some((a) => a.periode === PERIODE)).toBe(false);
    expect((await appelsDuContrat(alger, ctBrouillon)).some((a) => a.periode === PERIODE)).toBe(false);
  });

  it("est idempotente : une seconde génération ne crée aucun doublon", async () => {
    const res = await handleAppelsGenerer(
      req("/api/appels/generer", "POST", alger, { periode: PERIODE, dateEcheance: "2099-12-31" }),
      s,
    );
    expect(res.status).toBe(201);
    const { resume } = (await res.json()) as { resume: Resume };
    expect(resume.crees).toBe(0);
    expect(resume.ignoresExistants).toBeGreaterThanOrEqual(2);
    // Toujours un seul appel pour la période sur le contrat 1.
    expect((await appelsDuContrat(alger, ctActif1)).filter((a) => a.periode === PERIODE)).toHaveLength(1);
  });

  it("isole les organismes : la génération d'Oran n'affecte pas les contrats d'Alger", async () => {
    const res = await handleAppelsGenerer(
      req("/api/appels/generer", "POST", oran, { periode: PERIODE, dateEcheance: "2099-12-31" }),
      s,
    );
    expect(res.status).toBe(201);
    // L'appel d'Alger reste unique et inchangé (RLS : Oran ne voit pas ses contrats).
    expect((await appelsDuContrat(alger, ctActif1)).filter((a) => a.periode === PERIODE)).toHaveLength(1);
  });

  it("refuse la génération à un rôle sans droit de création (AUDITEUR → 403)", async () => {
    const res = await handleAppelsGenerer(
      req("/api/appels/generer", "POST", auditeur, { periode: PERIODE, dateEcheance: "2099-12-31" }),
      s,
    );
    expect(res.status).toBe(403);
  });
});
