// Tests d'intégration des filtres + pagination du journal d'audit.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services.js";
import { handleLogin } from "@/http/auth.js";
import { handleAudit } from "@/http/audit.js";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
const MARQUEUR = "zztest-audit-filtre"; // token unique pour des assertions déterministes
let s: Services;
let cookie: string;

beforeAll(async () => {
  s = buildServices({
    DATABASE_URL: requireEnv("TEST_DATABASE_URL"),
    DIRECT_DATABASE_URL: requireEnv("TEST_DIRECT_DATABASE_URL"),
    SESSION_SECRET: "integration-secret-at-least-16",
    ISOLATION_MODE: "shared",
    COOKIE_SECURE: "false",
  });
  const alger = await s.admin.organisation.findUniqueOrThrow({ where: { code: "OPGI-ALGER" } });
  // 3 SUCCES + 2 ECHEC, action unique, pour des comptes déterministes.
  for (let i = 0; i < 5; i++) {
    await s.admin.auditLog.create({
      data: {
        organisationId: alger.id,
        action: `${MARQUEUR}.action`,
        objetType: "Test",
        resultat: i < 3 ? "SUCCES" : "ECHEC",
        resume: `${MARQUEUR} #${i}`,
      },
    });
  }
  const res = await handleLogin(
    new Request(`${ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { origin: ORIGIN, host: HOST, "content-type": "application/json" },
      body: JSON.stringify({ code: "OPGI-ALGER", email: "auditeur@opgi-alger.demo", password: DEMO_PASSWORD }),
    }),
    s,
  );
  cookie = res.headers.get("set-cookie")!.split(";")[0]!;
});

afterAll(async () => {
  await s.app.$disconnect();
  await s.admin.$disconnect();
});

function lister(query: string): Promise<Response> {
  return handleAudit(new Request(`${ORIGIN}/api/audit${query}`, { headers: { cookie } }), s);
}

describe("journal d'audit — filtres + pagination", () => {
  it("un rôle sans droit de lecture d'audit est refusé (403)", async () => {
    const r = await handleLogin(
      new Request(`${ORIGIN}/api/auth/login`, {
        method: "POST",
        headers: { origin: ORIGIN, host: HOST, "content-type": "application/json" },
        body: JSON.stringify({ code: "OPGI-ALGER", email: "agent@opgi-alger.demo", password: DEMO_PASSWORD }),
      }),
      s,
    );
    const ck = r.headers.get("set-cookie")!.split(";")[0]!;
    expect((await handleAudit(new Request(`${ORIGIN}/api/audit`, { headers: { cookie: ck } }), s)).status).toBe(403);
  });

  it("filtre q : X-Total-Count reflète les correspondances", async () => {
    const res = await lister(`?q=${MARQUEUR}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-total-count")).toBe("5");
    const body = (await res.json()) as { entries: { action: string }[] };
    expect(body.entries.length).toBe(5);
    expect(body.entries.every((e) => e.action.startsWith(MARQUEUR))).toBe(true);
  });

  it("filtre résultat combiné à q", async () => {
    expect((await lister(`?q=${MARQUEUR}&resultat=ECHEC`)).headers.get("x-total-count")).toBe("2");
    expect((await lister(`?q=${MARQUEUR}&resultat=SUCCES`)).headers.get("x-total-count")).toBe("3");
  });

  it("pagination : page/perPage borne la page, total filtré conservé", async () => {
    const res = await lister(`?q=${MARQUEUR}&page=1&perPage=2`);
    expect(res.headers.get("x-total-count")).toBe("5");
    expect(res.headers.get("x-per-page")).toBe("2");
    const body = (await res.json()) as { entries: unknown[] };
    expect(body.entries.length).toBe(2);
  });
});
