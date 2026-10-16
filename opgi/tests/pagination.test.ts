// Tests d'intégration de la pagination + recherche sur les listes (opt-in).
// Vérifie : filtre texte `q`, bornes `page`/`perPage`, en-tête X-Total-Count,
// et préservation du comportement historique (sans paramètre → liste complète).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services.js";
import { handleLogin } from "@/http/auth.js";
import { handleBiens } from "@/http/patrimoine.js";
import { handleProjets } from "@/http/projets.js";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

let s: Services;
const HOST = "localhost:5184";
const ORIGIN = "http://localhost:5184";
const PREFIX = "PGT-"; // préfixe distinctif propre à ce test

beforeAll(async () => {
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
  expect(res.status).toBe(200);
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

async function creerBien(cookie: string, code: string): Promise<void> {
  const res = await handleBiens(
    new Request(`${ORIGIN}/api/biens`, {
      method: "POST",
      headers: { origin: ORIGIN, host: HOST, cookie, "content-type": "application/json" },
      body: JSON.stringify({ code, type: "LOGEMENT" }),
    }),
    s,
  );
  expect(res.status).toBe(201);
}

async function lister(cookie: string, query = ""): Promise<Response> {
  return handleBiens(new Request(`${ORIGIN}/api/biens${query}`, { headers: { cookie } }), s);
}

describe("pagination + recherche des biens", () => {
  let cookie: string;

  beforeAll(async () => {
    // OPGI-ORAN, agent locatif (droit A.creer) : isole ce jeu de données.
    cookie = await login("OPGI-ORAN", "agent@opgi-oran.demo");
    for (let i = 1; i <= 5; i++) {
      await creerBien(cookie, `${PREFIX}${String(i).padStart(4, "0")}`);
    }
  });

  it("sans paramètre : renvoie la liste complète, X-Total-Count présent, pas d'en-tête de page", async () => {
    const res = await lister(cookie);
    expect(res.status).toBe(200);
    const total = Number(res.headers.get("x-total-count"));
    const body = (await res.json()) as { biens: { code: string }[] };
    // Au moins les 5 créés + le bien initialement semé pour Oran.
    expect(total).toBeGreaterThanOrEqual(6);
    expect(body.biens.length).toBe(total);
    expect(res.headers.get("x-page")).toBeNull();
  });

  it("q filtre par code (insensible à la casse) et compte uniquement les correspondances", async () => {
    const res = await lister(cookie, "?q=pgt-");
    expect(res.status).toBe(200);
    const total = Number(res.headers.get("x-total-count"));
    const body = (await res.json()) as { biens: { code: string }[] };
    expect(total).toBe(5);
    expect(body.biens.length).toBe(5);
    expect(body.biens.every((b) => b.code.startsWith(PREFIX))).toBe(true);
  });

  it("page/perPage borne la page et X-Total-Count reste le total filtré", async () => {
    const p1 = await lister(cookie, "?q=PGT-&page=1&perPage=2");
    const p2 = await lister(cookie, "?q=PGT-&page=2&perPage=2");
    const p3 = await lister(cookie, "?q=PGT-&page=3&perPage=2");

    for (const r of [p1, p2, p3]) expect(r.headers.get("x-total-count")).toBe("5");
    expect(p1.headers.get("x-page")).toBe("1");
    expect(p1.headers.get("x-per-page")).toBe("2");

    const b1 = (await p1.json()) as { biens: { code: string }[] };
    const b2 = (await p2.json()) as { biens: { code: string }[] };
    const b3 = (await p3.json()) as { biens: { code: string }[] };
    expect(b1.biens.length).toBe(2);
    expect(b2.biens.length).toBe(2);
    expect(b3.biens.length).toBe(1); // reste de 5

    // Ordonné par code → pages disjointes et contiguës.
    const codes = [...b1.biens, ...b2.biens, ...b3.biens].map((b) => b.code);
    expect(new Set(codes).size).toBe(5);
    expect(codes).toEqual([...codes].sort());
  });

  it("perPage est borné à [1,100] (valeur hors limite ramenée à 100)", async () => {
    const res = await lister(cookie, "?perPage=9999&page=1");
    expect(res.headers.get("x-per-page")).toBe("100");
  });
});

describe("pagination + recherche des projets (module B)", () => {
  const PP = "PROJ-PGT-";
  let cookie: string;

  beforeAll(async () => {
    // OPGI-ORAN, gestionnaire des marchés (droit B.creer).
    cookie = await login("OPGI-ORAN", "gest@opgi-oran.demo");
    for (let i = 1; i <= 4; i++) {
      const res = await handleProjets(
        new Request(`${ORIGIN}/api/projets`, {
          method: "POST",
          headers: { origin: ORIGIN, host: HOST, cookie, "content-type": "application/json" },
          body: JSON.stringify({ code: `${PP}${String(i).padStart(3, "0")}`, intitule: `Projet test ${i}` }),
        }),
        s,
      );
      expect(res.status).toBe(201);
    }
  });

  it("q filtre les projets et le total reflète le filtre", async () => {
    const res = await handleProjets(
      new Request(`${ORIGIN}/api/projets?q=${PP}`, { headers: { cookie } }),
      s,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-total-count")).toBe("4");
    const body = (await res.json()) as { projets: { code: string }[] };
    expect(body.projets.length).toBe(4);
    expect(body.projets.every((p) => p.code.startsWith(PP))).toBe(true);
  });

  it("page/perPage borne la page, total filtré conservé", async () => {
    const res = await handleProjets(
      new Request(`${ORIGIN}/api/projets?q=${PP}&page=1&perPage=3`, { headers: { cookie } }),
      s,
    );
    expect(res.headers.get("x-total-count")).toBe("4");
    expect(res.headers.get("x-per-page")).toBe("3");
    const body = (await res.json()) as { projets: unknown[] };
    expect(body.projets.length).toBe(3);
  });
});
