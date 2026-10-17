// Tests d'intégration du cloisonnement des ordres de travail par PRESTATAIRE.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services.js";
import { handleLogin } from "@/http/auth.js";
import { handleReclamations } from "@/http/reclamations.js";
import { handleOrdres, handleOrdre } from "@/http/ordres.js";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
let s: Services;

beforeAll(() => {
  s = buildServices({
    DATABASE_URL: requireEnv("TEST_DATABASE_URL"),
    DIRECT_DATABASE_URL: requireEnv("TEST_DIRECT_DATABASE_URL"),
    SESSION_SECRET: "integration-secret-at-least-16",
    ISOLATION_MODE: "shared",
    COOKIE_SECURE: "false",
  });
});
afterAll(async () => {
  await s.app.$disconnect();
  await s.admin.$disconnect();
});

async function login(email: string): Promise<string> {
  const res = await handleLogin(
    new Request(`${ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { origin: ORIGIN, host: HOST, "content-type": "application/json" },
      body: JSON.stringify({ code: "OPGI-ALGER", email, password: DEMO_PASSWORD }),
    }),
    s,
  );
  expect(res.status).toBe(200);
  return res.headers.get("set-cookie")!.split(";")[0]!;
}
function req(method: string, cookie: string, body?: unknown, url = `${ORIGIN}/api/x`): Request {
  const headers: Record<string, string> = { origin: ORIGIN, host: HOST, cookie };
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
}
async function jsonOf<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

describe("cloisonnement des ordres de travail par prestataire", () => {
  it("un prestataire ne voit/modifie QUE les OT qui lui sont affectés", async () => {
    const resp = await login("resp@opgi-alger.demo");
    const prestaId = (await s.admin.utilisateur.findFirstOrThrow({ where: { email: "presta@opgi-alger.demo" } })).id;

    // Réclamation + OT affecté au compte prestataire.
    const rec = await jsonOf<{ reclamation: { id: string } }>(
      await handleReclamations(req("POST", resp, { categorie: "ASCENSEUR", description: "OT presta" }), s),
    );
    const ot = await jsonOf<{ ordre: { id: string; reference: string } }>(
      await handleOrdres(
        req("POST", resp, {
          reclamationId: rec.reclamation.id,
          affectationType: "EXTERNE",
          prestataireNom: "Ets Maintenance",
          prestataireUtilisateurId: prestaId,
        }),
        s,
      ),
    );

    // Le prestataire affecté voit son OT.
    const presta = await login("presta@opgi-alger.demo");
    const liste = await jsonOf<{ ordres: { id: string }[] }>(await handleOrdres(req("GET", presta), s));
    expect(liste.ordres.some((o) => o.id === ot.ordre.id)).toBe(true);

    // Un AUTRE prestataire ne le voit pas, et ne peut pas le modifier (404).
    const presta2 = await login("presta2@opgi-alger.demo");
    const liste2 = await jsonOf<{ ordres: { id: string }[] }>(await handleOrdres(req("GET", presta2), s));
    expect(liste2.ordres.some((o) => o.id === ot.ordre.id)).toBe(false);
    expect((await handleOrdre(req("PATCH", presta2, { compteRendu: "pirate" }), s, ot.ordre.id)).status).toBe(404);

    // Le prestataire affecté peut renseigner son compte rendu.
    const maj = await handleOrdre(req("PATCH", presta, { compteRendu: "Intervention réalisée." }), s, ot.ordre.id);
    expect(maj.status).toBe(200);

    // Un technicien interne ne voit pas l'OT prestataire (cloisonnement croisé).
    const tech = await login("tech@opgi-alger.demo");
    const listeTech = await jsonOf<{ ordres: { id: string }[] }>(await handleOrdres(req("GET", tech), s));
    expect(listeTech.ordres.some((o) => o.id === ot.ordre.id)).toBe(false);
  });
});
