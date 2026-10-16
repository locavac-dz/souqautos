// Tests d'intégration du Module C : réclamations (portail occupant),
// qualification, doublons, commentaires internes, ordres de travail et
// cloisonnement par propriété (occupant / technicien) — vraie base PostgreSQL.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services";
import { handleLogin } from "@/http/auth";
import {
  handleReclamations,
  handleReclamation,
  handleReclamationDoublon,
  handleCommentaires,
} from "@/http/reclamations";
import { handleOrdres, handleOrdre } from "@/http/ordres";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
let s: Services;
const ck = {} as Record<"resp" | "tech" | "tech2" | "occ" | "occ2" | "auditeur" | "oran", string>;
let techId = "";

beforeAll(async () => {
  s = buildServices({
    DATABASE_URL: requireEnv("TEST_DATABASE_URL"),
    DIRECT_DATABASE_URL: requireEnv("TEST_DIRECT_DATABASE_URL"),
    SESSION_SECRET: "integration-secret-at-least-16",
    ISOLATION_MODE: "shared",
    COOKIE_SECURE: "false",
  });
  ck.resp = await login("OPGI-ALGER", "resp@opgi-alger.demo");
  ck.tech = await login("OPGI-ALGER", "tech@opgi-alger.demo");
  ck.tech2 = await login("OPGI-ALGER", "tech2@opgi-alger.demo");
  ck.occ = await login("OPGI-ALGER", "occ@opgi-alger.demo");
  ck.occ2 = await login("OPGI-ALGER", "occ2@opgi-alger.demo");
  ck.auditeur = await login("OPGI-ALGER", "auditeur@opgi-alger.demo");
  ck.oran = await login("OPGI-ORAN", "agent@opgi-oran.demo");
  techId = (await s.admin.utilisateur.findFirstOrThrow({ where: { email: "tech@opgi-alger.demo" } })).id;
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

describe("Réclamations — portail occupant & propriété", () => {
  let recId = "";

  it("un occupant crée une réclamation (déclarant = lui, référence auto)", async () => {
    const res = await handleReclamations(
      req("POST", ck.occ, { categorie: "PLOMBERIE", description: "Fuite sous l'évier" }),
      s,
    );
    expect(res.status).toBe(201);
    const { reclamation } = await jsonOf<{ reclamation: { id: string; reference: string; canal: string } }>(res);
    expect(reclamation.reference).toMatch(/^REC-/);
    expect(reclamation.canal).toBe("PORTAIL");
    recId = reclamation.id;
  });

  it("l'occupant voit sa réclamation, mais pas un autre occupant", async () => {
    const mine = await jsonOf<{ reclamations: { id: string }[] }>(
      await handleReclamations(req("GET", ck.occ), s),
    );
    expect(mine.reclamations.some((r) => r.id === recId)).toBe(true);

    const autre = await jsonOf<{ reclamations: { id: string }[] }>(
      await handleReclamations(req("GET", ck.occ2), s),
    );
    expect(autre.reclamations.some((r) => r.id === recId)).toBe(false);

    // Accès direct par id refusé à l'autre occupant.
    expect((await handleReclamation(req("GET", ck.occ2), s, recId)).status).toBe(404);
  });

  it("un responsable qualifie ; un occupant ne peut pas (403)", async () => {
    const q = await handleReclamation(req("PATCH", ck.resp, { statut: "QUALIFIEE", urgence: "HAUTE" }), s, recId);
    expect(q.status).toBe(200);
    expect((await jsonOf<{ reclamation: { statut: string } }>(q)).reclamation.statut).toBe("QUALIFIEE");

    const refus = await handleReclamation(req("PATCH", ck.occ, { statut: "RESOLUE" }), s, recId);
    expect(refus.status).toBe(403);
  });

  it("un AUDITEUR ne peut pas créer de réclamation (403)", async () => {
    const res = await handleReclamations(req("POST", ck.auditeur, { categorie: "AUTRE", description: "x" }), s);
    expect(res.status).toBe(403);
  });

  it("regroupe une réclamation comme doublon d'une autre (historique conservé)", async () => {
    const autre = await jsonOf<{ reclamation: { id: string } }>(
      await handleReclamations(req("POST", ck.resp, { categorie: "PLOMBERIE", description: "Même fuite" }), s),
    );
    const d = await handleReclamationDoublon(req("POST", ck.resp, { doublonDeId: autre.reclamation.id }), s, recId);
    expect(d.status).toBe(200);
    expect((await jsonOf<{ reclamation: { statut: string } }>(d)).reclamation.statut).toBe("DOUBLON");
  });

  it("commentaires : l'occupant ne voit jamais les notes internes", async () => {
    await handleCommentaires(req("POST", ck.occ, { texte: "Merci de passer vite." }), s, recId);
    await handleCommentaires(req("POST", ck.resp, { texte: "Note interne agent", interne: true }), s, recId);

    const vueOcc = await jsonOf<{ commentaires: { texte: string; interne: boolean }[] }>(
      await handleCommentaires(req("GET", ck.occ), s, recId),
    );
    expect(vueOcc.commentaires.every((c) => c.interne === false)).toBe(true);
    expect(vueOcc.commentaires.some((c) => c.texte === "Note interne agent")).toBe(false);

    const vueResp = await jsonOf<{ commentaires: unknown[] }>(
      await handleCommentaires(req("GET", ck.resp), s, recId),
    );
    expect(vueResp.commentaires.length).toBeGreaterThan(vueOcc.commentaires.length);
  });

  it("isolation inter‑OPGI : Oran ne voit pas la réclamation d'Alger (404)", async () => {
    expect((await handleReclamation(req("GET", ck.oran), s, recId)).status).toBe(404);
  });
});

describe("Ordres de travail — propriété du technicien", () => {
  let recId = "";
  let otId = "";

  beforeAll(async () => {
    const r = await jsonOf<{ reclamation: { id: string } }>(
      await handleReclamations(req("POST", ck.resp, { categorie: "ELECTRICITE", description: "Panne" }), s),
    );
    recId = r.reclamation.id;
  });

  it("un occupant ne peut pas créer d'ordre de travail (403)", async () => {
    const res = await handleOrdres(req("POST", ck.occ, { reclamationId: recId }), s);
    expect(res.status).toBe(403);
  });

  it("un responsable crée un OT affecté à un technicien", async () => {
    const res = await handleOrdres(
      req("POST", ck.resp, { reclamationId: recId, affectationType: "INTERNE", technicienUtilisateurId: techId }),
      s,
    );
    expect(res.status).toBe(201);
    otId = (await jsonOf<{ ordre: { id: string } }>(res)).ordre.id;
  });

  it("le technicien affecté voit son OT ; l'autre technicien non", async () => {
    const vueTech = await jsonOf<{ ordres: { id: string }[] }>(await handleOrdres(req("GET", ck.tech), s));
    expect(vueTech.ordres.some((o) => o.id === otId)).toBe(true);

    const vueTech2 = await jsonOf<{ ordres: { id: string }[] }>(await handleOrdres(req("GET", ck.tech2), s));
    expect(vueTech2.ordres.some((o) => o.id === otId)).toBe(false);
    expect((await handleOrdre(req("GET", ck.tech2), s, otId)).status).toBe(404);
  });

  it("le technicien met à jour SON OT ; l'autre ne le peut pas (404)", async () => {
    const maj = await handleOrdre(
      req("PATCH", ck.tech, { statut: "EN_COURS", coutConstateCentimes: 25000, compteRendu: "Intervention faite" }),
      s,
      otId,
    );
    expect(maj.status).toBe(200);
    expect((await jsonOf<{ ordre: { statut: string } }>(maj)).ordre.statut).toBe("EN_COURS");

    const refus = await handleOrdre(req("PATCH", ck.tech2, { statut: "CLOTURE" }), s, otId);
    expect(refus.status).toBe(404);
  });
});
