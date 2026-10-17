// Test d'intégration du récépissé PDF : accès médié par propriété (occupant).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services.js";
import { handleLogin } from "@/http/auth.js";
import { handleReclamations, handleReclamationPdf } from "@/http/reclamations.js";
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

describe("récépissé PDF de réclamation", () => {
  it("le déclarant télécharge SA réclamation en PDF ; un autre occupant non (404)", async () => {
    const occ = await login("occ@opgi-alger.demo");
    const occ2 = await login("occ2@opgi-alger.demo");
    const rec = (await (
      await handleReclamations(req("POST", occ, { categorie: "PLOMBERIE", description: "Fuite (test) pdf" }), s)
    ).json()) as { reclamation: { id: string; reference: string } };

    const ok = await handleReclamationPdf(req("GET", occ), s, rec.reclamation.id);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect(ok.headers.get("content-disposition")).toContain(`reclamation-${rec.reclamation.reference}.pdf`);
    const buf = Buffer.from(await ok.arrayBuffer());
    expect(buf.toString("latin1").startsWith("%PDF-1.4")).toBe(true);

    // Cloisonnement par propriété : un autre occupant ne voit pas la réclamation.
    const refuse = await handleReclamationPdf(req("GET", occ2), s, rec.reclamation.id);
    expect(refuse.status).toBe(404);
  });

  it("id inexistant → 404", async () => {
    const occ = await login("occ@opgi-alger.demo");
    expect((await handleReclamationPdf(req("GET", occ), s, "inexistant")).status).toBe(404);
  });
});
