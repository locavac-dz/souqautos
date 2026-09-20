import { expect, test, type Page } from "@playwright/test";
import { disconnectE2eDb, e2eDb } from "../e2e/db";

// Lot 135 — performance mesurée dans un vrai navigateur, sur la VERSION DE PRODUCTION (le mode développement, non
// optimisé, fausserait tout). On ne mesure que ce qui est stable d'une exécution à l'autre : l'élément le plus gros
// affiché (LCP) et la façon dont il est chargé, les décalages de mise en page (CLS), le poids du JavaScript et des images.
// Les temps en millisecondes varient trop d'une machine à l'autre pour servir de seuil de test : ils sont seulement affichés.
test.afterAll(disconnectE2eDb);

type Metrics = {
  lcp: { tag: string; loading: string | null; fetchPriority: string | null; src: string; time: number } | null;
  cls: number;
  jsKb: number; // JavaScript demandé par la page elle-même (balises <script>, imports dynamiques)
  jsPrefetchKb: number; // JavaScript des AUTRES pages, préchargé par les liens visibles : n'entre pas dans le poids de la page
  topChunks: string[];
  imageKb: number;
  cssKb: number;
  requests: number;
};

async function observe(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp?: PerformanceEntry & { element?: Element; url?: string }; __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__lcp = entry as typeof w.__lcp;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!entry.hadRecentInput) w.__cls += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
}

async function measure(page: Page, path: string): Promise<Metrics> {
  await page.goto(path, { waitUntil: "load" });
  await page.waitForTimeout(1500); // laisse aux mesures le temps de se stabiliser après le chargement
  return page.evaluate(() => {
    const w = window as unknown as { __lcp?: PerformanceEntry & { element?: Element; url?: string }; __cls: number };
    const el = w.__lcp?.element as HTMLImageElement | undefined;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const kb = (filter: (r: PerformanceResourceTiming) => boolean) => Math.round(resources.filter(filter).reduce((sum, r) => sum + (r.encodedBodySize || 0), 0) / 1024);
    return {
      lcp: w.__lcp ? { tag: el?.tagName.toLowerCase() ?? "?", loading: el?.getAttribute?.("loading") ?? null, fetchPriority: el?.getAttribute?.("fetchpriority") ?? null, src: (w.__lcp.url ?? "").slice(-70), time: Math.round(w.__lcp.startTime) } : null,
      cls: Math.round(w.__cls * 1000) / 1000,
      jsKb: kb((r) => /\.js(\?|$)/.test(r.name) && r.initiatorType !== "link" && r.initiatorType !== "fetch"),
      jsPrefetchKb: kb((r) => /\.js(\?|$)/.test(r.name) && (r.initiatorType === "link" || r.initiatorType === "fetch")),
      topChunks: resources
        .filter((r) => /\.js(\?|$)/.test(r.name) && r.initiatorType !== "link" && r.initiatorType !== "fetch")
        .sort((a, b) => b.encodedBodySize - a.encodedBodySize)
        .slice(0, 4)
        .map((r) => `${r.name.split("/").pop()!.slice(0, 22)}:${Math.round(r.encodedBodySize / 1024)}`),
      imageKb: kb((r) => r.initiatorType === "img" || /\/_next\/image|\.(jpe?g|png|webp|avif)(\?|$)/.test(r.name)),
      cssKb: kb((r) => /\.css(\?|$)/.test(r.name)),
      requests: resources.length,
    };
  });
}

// Budgets : le poids d'aujourd'hui (première visite, fichiers compressés) plus une marge. Un test qui échoue ici ne dit pas
// « c'est trop lourd », il dit « le poids a bondi » : à examiner (nouvelle bibliothèque ? import mal placé ?) avant de
// relever le seuil, jamais en réflexe.
const JS_BUDGET_KB = 300; // mesuré : ~233 Ko
const CSS_BUDGET_KB = 30; // mesuré : ~8 Ko
const CLS_BUDGET = 0.05; // « bon » selon Google : 0,1 ; mesuré : 0

test.describe("performance en production", () => {
  test("pages principales : image principale jamais différée, pas de décalage de mise en page, JavaScript et CSS dans le budget", async ({ browser }) => {
    test.setTimeout(240_000);
    const listing = await e2eDb().listing.findFirstOrThrow({ where: { status: "PUBLIEE" }, select: { id: true } });
    const rows: string[] = [];
    const problems: string[] = [];
    for (const path of ["/fr", "/ar", "/fr/recherche", "/ar/recherche", `/fr/annonce/${listing.id}`, "/fr/voitures", "/fr/voitures/renault/clio", "/fr/guides", "/fr/mag"]) {
      // Un navigateur neuf par page = une PREMIÈRE visite : fichiers compressés, sans service worker ni cache.
      const context = await browser.newContext();
      const page = await context.newPage();
      await observe(page);
      const m = await measure(page, path);
      await context.close();
      rows.push(`${path.padEnd(34)} LCP=${m.lcp ? `${m.lcp.tag}(${m.lcp.loading ?? "-"}/${m.lcp.fetchPriority ?? "-"}) ${m.lcp.time}ms` : "-"}  CLS=${m.cls}  js=${m.jsKb}ko  css=${m.cssKb}ko  img=${m.imageKb}ko  req=${m.requests}`);

      if (m.lcp?.tag === "img" && m.lcp.loading === "lazy") problems.push(`${path} : l'image principale (${m.lcp.src}) est en chargement différé (lazy) : le navigateur la demande en retard`);
      if (m.cls > CLS_BUDGET) problems.push(`${path} : décalage de mise en page ${m.cls} (budget ${CLS_BUDGET})`);
      if (m.jsKb > JS_BUDGET_KB) problems.push(`${path} : ${m.jsKb} Ko de JavaScript (budget ${JS_BUDGET_KB})`);
      if (m.cssKb > CSS_BUDGET_KB) problems.push(`${path} : ${m.cssKb} Ko de CSS (budget ${CSS_BUDGET_KB})`);
    }
    console.log(["", "=== PERF ===", ...rows, "=== FIN ==="].join("\n")); // pour suivre l'évolution ; les temps ne sont pas des seuils
    expect(problems).toEqual([]);
  });

  test("les photos et leurs versions redimensionnées sont gardées un an par le navigateur ; les pages, jamais", async ({ request }) => {
    const photo = await e2eDb().listingPhoto.findFirstOrThrow({ select: { path: true } });
    const original = await request.get(photo.path);
    expect(original.status()).toBe(200);
    expect(original.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");

    const resized = await request.get(`/_next/image?url=${encodeURIComponent(photo.path)}&w=384&q=75`);
    expect(resized.status()).toBe(200);
    expect(resized.headers()["content-type"]).toMatch(/^image\//);
    expect(resized.headers()["cache-control"]).toMatch(/max-age=31536000/);

    // Une page change à chaque visite (connexion, nonce de sécurité) : jamais gardée.
    expect(/no-store|no-cache|private|max-age=0/.test((await request.get("/fr")).headers()["cache-control"] ?? "")).toBe(true);
    // Les fichiers du site portent un nom qui change à chaque version : eux aussi sont gardés un an (réglage de Next.js).
    const chunk = /\/_next\/static\/[^"' ]+\.js/.exec(await (await request.get("/fr")).text())?.[0];
    expect(chunk, "aucun fichier JavaScript dans la page").toBeTruthy();
    expect((await request.get(chunk!)).headers()["cache-control"]).toMatch(/max-age=31536000.*immutable/);
  });
});
