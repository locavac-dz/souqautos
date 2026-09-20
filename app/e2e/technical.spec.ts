import { test, expect } from "@playwright/test";
import { uniqueAccount, registerAndLogin } from "./fixtures";
import { createListing } from "./api-helpers";
import { disconnectE2eDb, e2eDb } from "./db";

// Lot 131 — ce que voient les moteurs de recherche, la supervision et la mesure d'audience : robots.txt, plan du
// site, point de contrôle de santé, balise d'audience. Aucune de ces réponses n'est une page : un test de bout en
// bout est le seul moyen de vérifier qu'elles sont bien servies par le vrai site, avec la vraie base.
test.afterAll(disconnectE2eDb);

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

test.describe("robots.txt et plan du site", () => {
  test("robots.txt bloque les espaces privés dans les deux langues et annonce le plan du site", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const text = await response.text();

    for (const blocked of ["/api/", "/*/compte", "/*/publier", "/*/admin", "/*/pro/statistiques", "/*/pro/prospects", "/*/connexion"]) {
      expect(text, blocked).toContain(`Disallow: ${blocked}`);
    }
    // Les pages publiques ne doivent JAMAIS être bloquées : une règle trop large ferait disparaître le site des résultats.
    // Une règle robots.txt est un préfixe où « * » remplace n'importe quelle suite de caractères (Google, Bing).
    const rules = text
      .split("\n")
      .filter((line) => line.startsWith("Disallow:"))
      .map((line) => line.replace("Disallow:", "").trim())
      .filter(Boolean);
    const blocks = (rule: string, path: string) => new RegExp("^" + rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")).test(path);
    for (const open of ["/fr/annonce/abc", "/ar/annonce/abc", "/fr/recherche", "/ar/recherche", "/fr/voitures/renault", "/fr/mag", "/fr/guides", "/fr/essais", "/fr"]) {
      expect(rules.filter((rule) => blocks(rule, open)), `${open} est bloqué`).toEqual([]);
    }
    // Et les règles interprétées de la même façon bloquent bien les espaces privés, dans les deux langues.
    for (const closed of ["/fr/compte/messages", "/ar/compte/favoris", "/fr/admin/journal", "/ar/admin", "/fr/publier/etape-2", "/fr/pro/statistiques", "/api/health"]) {
      expect(rules.some((rule) => blocks(rule, closed)), `${closed} devrait être bloqué`).toBe(true);
    }
    expect(text).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
  });

  test("le plan du site liste les annonces publiées, les marques de tous les types de véhicules, et dans les deux langues", async ({ page, request }) => {
    await registerAndLogin(page, "fr", uniqueAccount("sitemap"));
    const published = await createListing(page, { title: `Annonce publiée pour le plan du site ${Date.now()}` });
    const pending = await createListing(page, { title: `Annonce en attente hors plan du site ${Date.now()}`, publish: false });

    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");
    const xml = await response.text();

    expect(xml).toContain(`/fr/annonce/${published.id}`);
    expect(xml).toContain(`/ar/annonce/${published.id}`);
    expect(xml).toMatch(new RegExp(`hreflang="ar"[^>]*/ar/annonce/${published.id}`));
    // Une annonce en attente de modération n'est pas publique : elle ne doit pas être proposée aux moteurs.
    expect(xml).not.toContain(pending.id);

    // Lot 130 : marques et modèles de tous les types de véhicules.
    for (const path of ["/fr/voitures/yamaha/mt-07", "/fr/voitures/scania", "/fr/voitures/snvi/k66", "/fr/voitures/renault/trafic", "/fr/guides", "/fr/essais"]) {
      expect(xml, path).toContain(path);
    }
    // Aucun espace privé dans le plan du site.
    expect(xml).not.toMatch(/\/(fr|ar)\/(compte|admin|publier|connexion)/);
  });
});

test.describe("supervision", () => {
  test("/api/health répond 200 avec l'état de la base, sans aucune donnée sensible", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ status: "ok", checks: { database: "ok" } });
    expect(Object.keys(body).sort()).toEqual(["checks", "status"]);
    const text = JSON.stringify(body).toLowerCase();
    for (const secret of ["password", "secret", "postgres", "localhost", "version"]) expect(text).not.toContain(secret);
  });
});

test.describe("mesure d'audience sans cookie", () => {
  const viewsOf = async (page: string) => (await e2eDb().pageViewDay.aggregate({ where: { page }, _sum: { count: true } }))._sum.count ?? 0;
  const beacon = (request: import("@playwright/test").APIRequestContext, path: string, headers: Record<string, string> = {}) =>
    request.post("/api/analytics/collect", { data: JSON.stringify({ path, referrer: "" }), headers: { "user-agent": BROWSER_UA, "content-type": "text/plain", ...headers } });

  test("une page vue dans un vrai navigateur est comptée, sans cookie", async ({ page, context }) => {
    const before = await viewsOf("/essais");
    await page.goto("/fr/essais");
    await expect.poll(() => viewsOf("/essais"), { timeout: 15_000 }).toBeGreaterThan(before);
    // Aucun cookie posé par la mesure d'audience (le site n'en pose que pour la connexion).
    expect(await context.cookies()).toEqual([]);
  });

  test("la balise répond toujours 204 et ne compte que les visites publiques, sans « Ne pas me suivre », hors robots", async ({ request }) => {
    const before = await viewsOf("/guides");

    // Comptée : visiteur ordinaire sur une page publique.
    expect((await beacon(request, "/fr/guides")).status()).toBe(204);
    await expect.poll(() => viewsOf("/guides"), { timeout: 15_000 }).toBe(before + 1);

    // Ignorées, avec la MÊME réponse 204 (un visiteur malveillant n'apprend rien) :
    const ignored = [
      await beacon(request, "/fr/guides", { dnt: "1" }),
      await beacon(request, "/fr/guides", { "sec-gpc": "1" }),
      await beacon(request, "/fr/guides", { "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" }),
      await beacon(request, "/fr/compte/messages"),
      await beacon(request, "/fr/admin"),
      await request.post("/api/analytics/collect", { data: "pas du json", headers: { "user-agent": BROWSER_UA } }),
    ];
    for (const response of ignored) expect(response.status()).toBe(204);

    // Laisser le temps à un éventuel enregistrement (en tâche de fond) de se produire, puis vérifier qu'il n'y en a pas eu.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(await viewsOf("/guides")).toBe(before + 1);
    expect(await e2eDb().pageViewDay.count({ where: { page: { contains: "compte" } } })).toBe(0);
    expect(await e2eDb().pageViewDay.count({ where: { page: { contains: "admin" } } })).toBe(0);
  });

  test("le compteur ne garde ni adresse IP, ni User-Agent, ni recherche : seulement des catégories", async ({ request }) => {
    const before = await viewsOf("/recherche");
    expect((await beacon(request, "/fr/recherche?q=secret-personnel-12345")).status()).toBe(204);
    // La visite EST comptée (sinon l'absence de la recherche ci-dessous ne prouverait rien)…
    await expect.poll(() => viewsOf("/recherche"), { timeout: 15_000 }).toBeGreaterThan(before);
    // …mais sans ce qui l'accompagnait.
    const rows = await e2eDb().pageViewDay.findMany();
    const dump = JSON.stringify(rows);
    expect(dump).not.toContain("secret-personnel-12345");
    expect(dump).not.toContain("Chrome/126");
    expect(dump).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    for (const row of rows) {
      expect(["mobile", "tablette", "ordinateur"]).toContain(row.device);
      expect(["direct", "interne", "recherche", "reseaux", "autre"]).toContain(row.referrer);
    }
  });
});
