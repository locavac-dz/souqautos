// Test d'intégration de la fiche marché PDF (module B) : autorisation + isolation.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services.js";
import { handleLogin } from "@/http/auth.js";
import { handleProjets } from "@/http/projets.js";
import { handleEntreprises } from "@/http/entreprises.js";
import { handleMarches, handleMarchePdf } from "@/http/marches.js";
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
async function jsonOf<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

describe("fiche marché PDF", () => {
  it("un rôle B.lire télécharge la fiche ; Oran ne voit pas le marché d'Alger (404)", async () => {
    const chef = await login("OPGI-ALGER", "chef@opgi-alger.demo");
    const oran = await login("OPGI-ORAN", "gest@opgi-oran.demo");

    const p = await jsonOf<{ projet: { id: string } }>(
      await handleProjets(req("POST", chef, { code: "PRJ-PDF", intitule: "Projet PDF" }), s),
    );
    const e = await jsonOf<{ entreprise: { id: string } }>(
      await handleEntreprises(req("POST", chef, { raisonSociale: "PDF BTP", nif: "999" }), s),
    );
    const m = await jsonOf<{ marche: { id: string; reference: string } }>(
      await handleMarches(
        req("POST", chef, {
          reference: "M-PDF-01",
          projetId: p.projet.id,
          entrepriseId: e.entreprise.id,
          objet: "Travaux (test) PDF",
          montantCentimes: 5000000,
        }),
        s,
      ),
    );

    const ok = await handleMarchePdf(req("GET", chef), s, m.marche.id);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect(ok.headers.get("content-disposition")).toContain(`marche-${m.marche.reference}.pdf`);
    const buf = Buffer.from(await ok.arrayBuffer());
    expect(buf.toString("latin1").startsWith("%PDF-1.4")).toBe(true);

    // Isolation inter-OPGI.
    expect((await handleMarchePdf(req("GET", oran), s, m.marche.id)).status).toBe(404);
  });

  it("id inexistant → 404", async () => {
    const chef = await login("OPGI-ALGER", "chef@opgi-alger.demo");
    expect((await handleMarchePdf(req("GET", chef), s, "inexistant")).status).toBe(404);
  });
});
