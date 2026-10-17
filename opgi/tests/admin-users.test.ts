// Tests d'intégration de l'administration des comptes d'un organisme
// (ADMIN_OPGI) : création/login, unicité, politique de mot de passe, rôles
// non attribuables, anti-auto-verrouillage, réinitialisation, désactivation,
// révocation de session au changement de rôle, isolation inter-OPGI, droit requis.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services";
import { handleLogin } from "@/http/auth";
import { handleBiens } from "@/http/patrimoine";
import { handleAdminUtilisateurs, handleAdminUtilisateur, handleAdminMotDePasse } from "@/http/admin-users";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
const MDP_OK = "MotDePasse-1234"; // ≥ 12 caractères (politique par défaut)
let s: Services;
let adminAlger = "";
let adminOran = "";

beforeAll(async () => {
  s = buildServices({
    DATABASE_URL: requireEnv("TEST_DATABASE_URL"),
    DIRECT_DATABASE_URL: requireEnv("TEST_DIRECT_DATABASE_URL"),
    SESSION_SECRET: "integration-secret-at-least-16",
    ISOLATION_MODE: "shared",
    COOKIE_SECURE: "false",
  });
  adminAlger = cookieDe(await loginRes("OPGI-ALGER", "admin@opgi-alger.demo", DEMO_PASSWORD));
  adminOran = cookieDe(await loginRes("OPGI-ORAN", "admin@opgi-oran.demo", DEMO_PASSWORD));
});
afterAll(async () => {
  await s.app.$disconnect();
  await s.admin.$disconnect();
});

async function loginRes(code: string, email: string, password: string): Promise<Response> {
  return handleLogin(
    new Request(`${ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { origin: ORIGIN, host: HOST, "content-type": "application/json" },
      body: JSON.stringify({ code, email, password }),
    }),
    s,
  );
}
function cookieDe(res: Response): string {
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
async function creerCompte(cookie: string, body: unknown): Promise<Response> {
  return handleAdminUtilisateurs(req("/api/admin/utilisateurs", "POST", cookie, body), s);
}

describe("administration des comptes (ADMIN_OPGI)", () => {
  it("refuse l'accès à un non-administrateur (403)", async () => {
    const agent = cookieDe(await loginRes("OPGI-ALGER", "agent@opgi-alger.demo", DEMO_PASSWORD));
    const list = await handleAdminUtilisateurs(req("/api/admin/utilisateurs", "GET", agent), s);
    expect(list.status).toBe(403);
    const create = await creerCompte(agent, { email: "x@opgi-alger.demo", role: "AUDITEUR", password: MDP_OK });
    expect(create.status).toBe(403);
  });

  it("crée un compte, qui peut ensuite se connecter", async () => {
    const res = await creerCompte(adminAlger, { email: "nouveau@opgi-alger.demo", role: "AUDITEUR", password: MDP_OK });
    expect(res.status).toBe(201);
    const login = await loginRes("OPGI-ALGER", "nouveau@opgi-alger.demo", MDP_OK);
    expect(login.status).toBe(200);
  });

  it("refuse un e-mail déjà utilisé (409) et un mot de passe trop court (400)", async () => {
    const dup = await creerCompte(adminAlger, { email: "agent@opgi-alger.demo", role: "AUDITEUR", password: MDP_OK });
    expect(dup.status).toBe(409);
    const court = await creerCompte(adminAlger, { email: "court@opgi-alger.demo", role: "AUDITEUR", password: "court" });
    expect(court.status).toBe(400);
  });

  it("refuse d'attribuer le rôle technique ADMIN_PLATEFORME (400)", async () => {
    const res = await creerCompte(adminAlger, { email: "plat@opgi-alger.demo", role: "ADMIN_PLATEFORME", password: MDP_OK });
    expect(res.status).toBe(400);
  });

  it("empêche un administrateur de se désactiver (409)", async () => {
    const liste = (await (await handleAdminUtilisateurs(req("/api/admin/utilisateurs", "GET", adminAlger), s)).json()) as {
      comptes: { id: string; email: string }[];
    };
    const moi = liste.comptes.find((c) => c.email === "admin@opgi-alger.demo")!;
    const res = await handleAdminUtilisateur(req(`/api/admin/utilisateurs/${moi.id}`, "PATCH", adminAlger, { actif: false }), s, moi.id);
    expect(res.status).toBe(409);
  });

  it("réinitialise le mot de passe (ancien refusé, nouveau accepté)", async () => {
    await creerCompte(adminAlger, { email: "reset@opgi-alger.demo", role: "AUDITEUR", password: MDP_OK });
    const liste = (await (await handleAdminUtilisateurs(req("/api/admin/utilisateurs", "GET", adminAlger), s)).json()) as {
      comptes: { id: string; email: string }[];
    };
    const id = liste.comptes.find((c) => c.email === "reset@opgi-alger.demo")!.id;
    const nouveau = "NouveauMdp-9876";
    const res = await handleAdminMotDePasse(req(`/api/admin/utilisateurs/${id}/mot-de-passe`, "POST", adminAlger, { password: nouveau }), s, id);
    expect(res.status).toBe(200);
    expect((await loginRes("OPGI-ALGER", "reset@opgi-alger.demo", MDP_OK)).status).toBe(401);
    expect((await loginRes("OPGI-ALGER", "reset@opgi-alger.demo", nouveau)).status).toBe(200);
  });

  it("désactive un compte : la connexion est alors refusée", async () => {
    await creerCompte(adminAlger, { email: "off@opgi-alger.demo", role: "AUDITEUR", password: MDP_OK });
    const liste = (await (await handleAdminUtilisateurs(req("/api/admin/utilisateurs", "GET", adminAlger), s)).json()) as {
      comptes: { id: string; email: string }[];
    };
    const id = liste.comptes.find((c) => c.email === "off@opgi-alger.demo")!.id;
    expect((await loginRes("OPGI-ALGER", "off@opgi-alger.demo", MDP_OK)).status).toBe(200);
    const res = await handleAdminUtilisateur(req(`/api/admin/utilisateurs/${id}`, "PATCH", adminAlger, { actif: false }), s, id);
    expect(res.status).toBe(200);
    expect((await loginRes("OPGI-ALGER", "off@opgi-alger.demo", MDP_OK)).status).toBe(401);
  });

  it("révoque les sessions existantes lors d'un changement de rôle", async () => {
    await creerCompte(adminAlger, { email: "rev@opgi-alger.demo", role: "AGENT_LOCATIF", password: MDP_OK });
    const cookie = cookieDe(await loginRes("OPGI-ALGER", "rev@opgi-alger.demo", MDP_OK));
    // Jeton valide : AGENT_LOCATIF a « A lire ».
    expect((await handleBiens(req("/api/biens", "GET", cookie), s)).status).toBe(200);
    const liste = (await (await handleAdminUtilisateurs(req("/api/admin/utilisateurs", "GET", adminAlger), s)).json()) as {
      comptes: { id: string; email: string }[];
    };
    const id = liste.comptes.find((c) => c.email === "rev@opgi-alger.demo")!.id;
    await handleAdminUtilisateur(req(`/api/admin/utilisateurs/${id}`, "PATCH", adminAlger, { role: "AUDITEUR" }), s, id);
    // L'ancien jeton (epoch périmé) est désormais invalide, même si AUDITEUR a aussi « A lire ».
    expect((await handleBiens(req("/api/biens", "GET", cookie), s)).status).toBe(401);
  });

  it("isole les organismes : liste propre et mutation croisée introuvable (404)", async () => {
    // Crée un compte côté Oran, récupère son id via l'admin Oran.
    await creerCompte(adminOran, { email: "cible@opgi-oran.demo", role: "AUDITEUR", password: MDP_OK });
    const listeOran = (await (await handleAdminUtilisateurs(req("/api/admin/utilisateurs", "GET", adminOran), s)).json()) as {
      comptes: { id: string; email: string }[];
    };
    const idOran = listeOran.comptes.find((c) => c.email === "cible@opgi-oran.demo")!.id;

    // L'admin d'Alger ne voit aucun compte d'Oran…
    const listeAlger = (await (await handleAdminUtilisateurs(req("/api/admin/utilisateurs", "GET", adminAlger), s)).json()) as {
      comptes: { email: string }[];
    };
    expect(listeAlger.comptes.some((c) => c.email.endsWith("@opgi-oran.demo"))).toBe(false);

    // … et ne peut pas modifier un compte d'Oran (RLS → 404).
    const res = await handleAdminUtilisateur(req(`/api/admin/utilisateurs/${idOran}`, "PATCH", adminAlger, { actif: false }), s, idOran);
    expect(res.status).toBe(404);
    const reset = await handleAdminMotDePasse(req(`/api/admin/utilisateurs/${idOran}/mot-de-passe`, "POST", adminAlger, { password: MDP_OK }), s, idOran);
    expect(reset.status).toBe(404);
  });
});
