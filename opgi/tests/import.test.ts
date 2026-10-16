// Tests d'intégration de l'import initial : validation ligne à ligne, détection
// des doublons (fichier + base), rapport, isolation, autorisation, audit.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services";
import { handleLogin } from "@/http/auth";
import { handleImport } from "@/http/import";
import { handleBiens } from "@/http/patrimoine";
import { handleAudit } from "@/http/audit";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
let s: Services;
const ck = {} as Record<"agent" | "auditeur" | "oran", string>;

beforeAll(async () => {
  s = buildServices({
    DATABASE_URL: requireEnv("TEST_DATABASE_URL"),
    DIRECT_DATABASE_URL: requireEnv("TEST_DIRECT_DATABASE_URL"),
    SESSION_SECRET: "integration-secret-at-least-16",
    ISOLATION_MODE: "shared",
    COOKIE_SECURE: "false",
  });
  ck.agent = await login("OPGI-ALGER", "agent@opgi-alger.demo");
  ck.auditeur = await login("OPGI-ALGER", "auditeur@opgi-alger.demo");
  ck.oran = await login("OPGI-ORAN", "agent@opgi-oran.demo");
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

interface Rapport {
  total: number;
  inseres: number;
  ignores: number;
  rejets: { ligne: number; raison: string; cle: string | null }[];
}

describe("import des biens", () => {
  it("valide, détecte les doublons de fichier et les lignes invalides, et insère le reste", async () => {
    const csv = [
      "code,type,etatOccupation,adresse",
      "IMP-B-001,LOGEMENT,OCCUPE,Rue 1",
      "IMP-B-002,GARAGE,,",
      'IMP-B-003,LOGEMENT,OCCUPE,"Rue A, Alger"',
      "IMP-B-001,LOGEMENT,,", // doublon dans le fichier
      "BAD-1,PIZZA,,", // type invalide
    ].join("\n");

    const res = await handleImport(req("POST", ck.agent, { type: "biens", csv }), s);
    expect(res.status).toBe(200);
    const { rapport } = await jsonOf<{ rapport: Rapport }>(res);
    expect(rapport.total).toBe(5);
    expect(rapport.inseres).toBe(3);
    expect(rapport.ignores).toBe(2);
    expect(rapport.rejets.find((r) => r.raison === "doublon_fichier")?.ligne).toBe(5);
    expect(rapport.rejets.find((r) => r.raison === "invalide")?.ligne).toBe(6);

    // Les biens valides existent réellement (dont la virgule protégée).
    const biens = (await jsonOf<{ biens: { code: string; adresse: string | null }[] }>(
      await handleBiens(req("GET", ck.agent), s),
    )).biens;
    const b3 = biens.find((b) => b.code === "IMP-B-003");
    expect(b3?.adresse).toBe("Rue A, Alger");
  });

  it("détecte les doublons déjà présents en base (doublon_base)", async () => {
    const res = await handleImport(
      req("POST", ck.agent, { type: "biens", csv: "code,type\nIMP-B-001,LOGEMENT\nIMP-B-NEW,GARAGE" }),
      s,
    );
    const { rapport } = await jsonOf<{ rapport: Rapport }>(res);
    expect(rapport.inseres).toBe(1); // seul IMP-B-NEW
    expect(rapport.rejets.find((r) => r.cle === "IMP-B-001")?.raison).toBe("doublon_base");
  });

  it("l'import est isolé : Oran ne voit pas les biens importés par Alger", async () => {
    const biensOran = (await jsonOf<{ biens: { code: string }[] }>(
      await handleBiens(req("GET", ck.oran), s),
    )).biens;
    expect(biensOran.some((b) => b.code.startsWith("IMP-B-"))).toBe(false);
  });

  it("un AUDITEUR ne peut pas importer (403)", async () => {
    const res = await handleImport(req("POST", ck.auditeur, { type: "biens", csv: "code,type\nX,LOGEMENT" }), s);
    expect(res.status).toBe(403);
  });

  it("trace l'import dans le journal d'audit", async () => {
    const audit = await jsonOf<{ entries: { action: string }[] }>(await handleAudit(req("GET", ck.auditeur), s));
    expect(audit.entries.some((e) => e.action === "import.biens")).toBe(true);
  });
});

describe("import des occupants", () => {
  it("insère et détecte un doublon identique dans le fichier", async () => {
    const csv = [
      "type,nom,prenom,telephone,email",
      "PHYSIQUE,Benali,Karim,0550,karim@demo.dz",
      "PHYSIQUE,Benali,Karim,0550,karim@demo.dz", // identique → doublon_fichier
      "MORALE,Entreprise X,,021,",
      ",,,,", // nom manquant → invalide
    ].join("\n");
    const res = await handleImport(req("POST", ck.agent, { type: "occupants", csv }), s);
    const { rapport } = await jsonOf<{ rapport: Rapport }>(res);
    expect(rapport.inseres).toBe(2);
    expect(rapport.rejets.some((r) => r.raison === "doublon_fichier")).toBe(true);
    expect(rapport.rejets.some((r) => r.raison === "invalide")).toBe(true);
  });
});
