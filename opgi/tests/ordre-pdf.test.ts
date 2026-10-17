// Test d'intégration du bon d'ordre de travail PDF : propriété (technicien) + isolation.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services.js";
import { handleLogin } from "@/http/auth.js";
import { handleReclamations } from "@/http/reclamations.js";
import { handleOrdres, handleOrdrePdf } from "@/http/ordres.js";
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

describe("bon d'ordre de travail PDF", () => {
  it("le technicien affecté télécharge SON bon ; un autre technicien non (404)", async () => {
    const resp = await login("OPGI-ALGER", "resp@opgi-alger.demo");
    const techId = (await s.admin.utilisateur.findFirstOrThrow({ where: { email: "tech@opgi-alger.demo" } })).id;

    const rec = await jsonOf<{ reclamation: { id: string } }>(
      await handleReclamations(req("POST", resp, { categorie: "ELECTRICITE", description: "OT pdf" }), s),
    );
    const ot = await jsonOf<{ ordre: { id: string; reference: string } }>(
      await handleOrdres(
        req("POST", resp, { reclamationId: rec.reclamation.id, affectationType: "INTERNE", technicienUtilisateurId: techId }),
        s,
      ),
    );

    // Le technicien affecté peut télécharger.
    const tech = await login("OPGI-ALGER", "tech@opgi-alger.demo");
    const ok = await handleOrdrePdf(req("GET", tech), s, ot.ordre.id);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect(ok.headers.get("content-disposition")).toContain(`ordre-${ot.ordre.reference}.pdf`);
    expect(Buffer.from(await ok.arrayBuffer()).toString("latin1").startsWith("%PDF-1.4")).toBe(true);

    // Un AUTRE technicien ne voit pas cet OT (cloisonnement par propriété).
    const tech2 = await login("OPGI-ALGER", "tech2@opgi-alger.demo");
    expect((await handleOrdrePdf(req("GET", tech2), s, ot.ordre.id)).status).toBe(404);

    // Isolation inter-OPGI (agent locatif d'Oran a bien C.lire, mais 404 par organisme).
    const oran = await login("OPGI-ORAN", "agent@opgi-oran.demo");
    expect((await handleOrdrePdf(req("GET", oran), s, ot.ordre.id)).status).toBe(404);
  });
});
