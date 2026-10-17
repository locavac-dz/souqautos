// Tests d'intégration du Module B : projets, entreprises, marchés, situations
// de travaux (workflow + permission « valider »), réceptions, avancement et
// séparation engagé/constaté — contre une vraie base PostgreSQL.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services";
import { handleLogin } from "@/http/auth";
import { handleProjets } from "@/http/projets";
import { handleEntreprises } from "@/http/entreprises";
import {
  handleMarches,
  handleMarche,
  handleSituations,
  handleSituationDecision,
  handleReceptions,
} from "@/http/marches";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
let s: Services;
const ck = {} as Record<"chef" | "gest" | "auditeur" | "oran", string>;

beforeAll(async () => {
  s = buildServices({
    DATABASE_URL: requireEnv("TEST_DATABASE_URL"),
    DIRECT_DATABASE_URL: requireEnv("TEST_DIRECT_DATABASE_URL"),
    SESSION_SECRET: "integration-secret-at-least-16",
    ISOLATION_MODE: "shared",
    COOKIE_SECURE: "false",
  });
  ck.chef = await login("OPGI-ALGER", "chef@opgi-alger.demo");
  ck.gest = await login("OPGI-ALGER", "gest@opgi-alger.demo");
  ck.auditeur = await login("OPGI-ALGER", "auditeur@opgi-alger.demo");
  // Un utilisateur d'Oran AYANT les droits Module B : prouve que l'isolation
  // (et non l'absence de permission) bloque l'accès au marché d'Alger.
  ck.oran = await login("OPGI-ORAN", "gest@opgi-oran.demo");
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

let projetId = "";
let entrepriseId = "";
let marcheId = "";

describe("Projets, entreprises, marchés", () => {
  it("le chef de projet crée un projet et une entreprise", async () => {
    const p = await handleProjets(req("POST", ck.chef, { code: "PRJ-1", intitule: "Réhabilitation 100 logements" }), s);
    expect(p.status).toBe(201);
    projetId = (await jsonOf<{ projet: { id: string } }>(p)).projet.id;

    const e = await handleEntreprises(req("POST", ck.chef, { raisonSociale: "BTP Sarl", nif: "123" }), s);
    expect(e.status).toBe(201);
    entrepriseId = (await jsonOf<{ entreprise: { id: string } }>(e)).entreprise.id;
  });

  it("un AUDITEUR ne peut pas créer de projet (403)", async () => {
    expect((await handleProjets(req("POST", ck.auditeur, { code: "X", intitule: "Y" }), s)).status).toBe(403);
  });

  it("crée un marché (montant engagé) lié au projet et à l'entreprise", async () => {
    const m = await handleMarches(
      req("POST", ck.gest, {
        reference: "M-2026-01",
        projetId,
        entrepriseId,
        objet: "Travaux gros œuvre",
        montantCentimes: 10000000,
        dateNotification: "2026-01-01",
        delaiJours: 180,
      }),
      s,
    );
    expect(m.status).toBe(201);
    marcheId = (await jsonOf<{ marche: { id: string } }>(m)).marche.id;
  });

  it("refuse un marché référençant un projet d'un autre organisme (400)", async () => {
    const m = await handleMarches(
      req("POST", ck.oran, { reference: "M-X", projetId, entrepriseId, objet: "x", montantCentimes: 1000 }),
      s,
    );
    expect(m.status).toBe(400);
  });
});

describe("Situations de travaux — workflow et permission « valider »", () => {
  let situationId = "";

  it("dépose une situation (statut DEPOSEE)", async () => {
    const res = await handleSituations(
      req("POST", ck.chef, { numero: 1, montantTravauxCentimes: 4000000, avancementPhysiquePct: 40, dateDepot: "2026-02-01" }),
      s,
      marcheId,
    );
    expect(res.status).toBe(201);
    const { situation } = await jsonOf<{ situation: { id: string; statut: string } }>(res);
    expect(situation.statut).toBe("DEPOSEE");
    situationId = situation.id;
  });

  it("le chef de projet peut vérifier mais PAS valider (403) — délégation", async () => {
    const verif = await handleSituationDecision(req("POST", ck.chef, { decision: "VERIFIEE" }), s, situationId);
    expect(verif.status).toBe(200);

    const tentativeValidation = await handleSituationDecision(req("POST", ck.chef, { decision: "VALIDEE" }), s, situationId);
    expect(tentativeValidation.status).toBe(403);
  });

  it("le gestionnaire des marchés valide la situation (trace le décideur)", async () => {
    const res = await handleSituationDecision(req("POST", ck.gest, { decision: "VALIDEE" }), s, situationId);
    expect(res.status).toBe(200);
    expect((await jsonOf<{ situation: { statut: string } }>(res)).situation.statut).toBe("VALIDEE");
  });

  it("l'avancement du marché reflète la situation validée (constaté ≠ engagé)", async () => {
    const detail = await jsonOf<{
      montantEngageCentimes: number;
      montantConstateValideCentimes: number;
      avancementFinancierPct: number;
      avancementPhysiquePct: number | null;
      depassement: boolean;
    }>(await handleMarche(req("GET", ck.gest), s, marcheId));
    expect(detail.montantEngageCentimes).toBe(10000000);
    expect(detail.montantConstateValideCentimes).toBe(4000000);
    expect(detail.avancementFinancierPct).toBe(40);
    expect(detail.avancementPhysiquePct).toBe(40);
    expect(detail.depassement).toBe(false);
  });

  it("signale un dépassement quand le constaté validé dépasse l'engagé", async () => {
    await handleSituations(
      req("POST", ck.chef, { numero: 2, montantTravauxCentimes: 7000000, dateDepot: "2026-03-01" }),
      s,
      marcheId,
    );
    // Récupère la 2e situation et la valide.
    const liste = await jsonOf<{ situations: { id: string; numero: number }[] }>(
      await handleSituations(req("GET", ck.gest), s, marcheId),
    );
    const sit2 = liste.situations.find((x) => x.numero === 2)!;
    await handleSituationDecision(req("POST", ck.gest, { decision: "VALIDEE" }), s, sit2.id);

    const detail = await jsonOf<{ depassement: boolean; montantConstateValideCentimes: number }>(
      await handleMarche(req("GET", ck.gest), s, marcheId),
    );
    expect(detail.montantConstateValideCentimes).toBe(11000000);
    expect(detail.depassement).toBe(true);
  });
});

describe("Réceptions & isolation", () => {
  it("enregistre une réception provisoire avec réserves", async () => {
    const res = await handleReceptions(
      req("POST", ck.gest, { type: "PROVISOIRE", date: "2026-07-01", avecReserves: true, observations: "Réserves mineures" }),
      s,
      marcheId,
    );
    expect(res.status).toBe(201);
  });

  it("le détail du marché d'Alger est introuvable pour Oran (404)", async () => {
    expect((await handleMarche(req("GET", ck.oran), s, marcheId)).status).toBe(404);
  });
});
