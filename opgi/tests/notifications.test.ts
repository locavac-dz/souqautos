// Tests d'intégration des notifications internes : émission sur événement,
// cloisonnement par destinataire et par organisme, marquage comme lue.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services";
import { handleLogin } from "@/http/auth";
import { handleReclamations, handleReclamation } from "@/http/reclamations";
import { handleOrdres } from "@/http/ordres";
import { handleNotifications, handleNotificationLue } from "@/http/notifications";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
let s: Services;
const ck = {} as Record<"occ" | "occ2" | "resp" | "tech" | "oran", string>;
let techId = "";

beforeAll(async () => {
  s = buildServices({
    DATABASE_URL: requireEnv("TEST_DATABASE_URL"),
    DIRECT_DATABASE_URL: requireEnv("TEST_DIRECT_DATABASE_URL"),
    SESSION_SECRET: "integration-secret-at-least-16",
    ISOLATION_MODE: "shared",
    COOKIE_SECURE: "false",
  });
  ck.occ = await login("OPGI-ALGER", "occ@opgi-alger.demo");
  ck.occ2 = await login("OPGI-ALGER", "occ2@opgi-alger.demo");
  ck.resp = await login("OPGI-ALGER", "resp@opgi-alger.demo");
  ck.tech = await login("OPGI-ALGER", "tech@opgi-alger.demo");
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
type NotifList = { notifications: { id: string; type: string }[]; nonLues: number };

describe("notifications internes", () => {
  it("qualifier une réclamation notifie son déclarant (occupant), pas les autres", async () => {
    const rec = await jsonOf<{ reclamation: { id: string } }>(
      await handleReclamations(req("POST", ck.occ, { categorie: "PLOMBERIE", description: "Notif" }), s),
    );
    const q = await handleReclamation(req("PATCH", ck.resp, { statut: "QUALIFIEE" }), s, rec.reclamation.id);
    expect(q.status).toBe(200);

    const occN = await jsonOf<NotifList>(await handleNotifications(req("GET", ck.occ), s));
    expect(occN.notifications.some((n) => n.type === "reclamation.statut")).toBe(true);
    expect(occN.nonLues).toBeGreaterThan(0);

    const occ2N = await jsonOf<NotifList>(await handleNotifications(req("GET", ck.occ2), s));
    expect(occ2N.notifications.some((n) => n.type === "reclamation.statut")).toBe(false);
  });

  it("affecter un ordre de travail notifie le technicien", async () => {
    const rec = await jsonOf<{ reclamation: { id: string } }>(
      await handleReclamations(req("POST", ck.resp, { categorie: "ELECTRICITE", description: "OT notif" }), s),
    );
    const ot = await handleOrdres(
      req("POST", ck.resp, { reclamationId: rec.reclamation.id, affectationType: "INTERNE", technicienUtilisateurId: techId }),
      s,
    );
    expect(ot.status).toBe(201);

    const techN = await jsonOf<NotifList>(await handleNotifications(req("GET", ck.tech), s));
    expect(techN.notifications.some((n) => n.type === "ot.affectation")).toBe(true);
  });

  it("on ne marque comme lue que SA propre notification", async () => {
    const occN = await jsonOf<NotifList>(await handleNotifications(req("GET", ck.occ), s));
    const notifId = occN.notifications[0]!.id;

    // Un autre utilisateur ne peut pas la marquer (404).
    expect((await handleNotificationLue(req("POST", ck.occ2), s, notifId)).status).toBe(404);

    // Le destinataire la marque (200) → le compteur de non‑lues diminue.
    const avant = occN.nonLues;
    expect((await handleNotificationLue(req("POST", ck.occ), s, notifId)).status).toBe(200);
    const apres = await jsonOf<NotifList>(await handleNotifications(req("GET", ck.occ), s));
    expect(apres.nonLues).toBe(avant - 1);
  });

  it("isolation inter‑OPGI : Oran n'a aucune notification d'Alger", async () => {
    const oranN = await jsonOf<NotifList>(await handleNotifications(req("GET", ck.oran), s));
    expect(oranN.notifications).toHaveLength(0);
  });
});
