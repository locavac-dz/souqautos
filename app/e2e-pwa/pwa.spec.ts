import { expect, test, type Page } from "@playwright/test";

// Lot 120 — l'application installable, dans un vrai navigateur, sur une version de production.

async function waitForActiveWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // La page qui a enregistré le service worker n'en dépend pas encore : on la recharge pour
  // qu'il la contrôle, comme le fait une deuxième visite.
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

async function cachedPaths(page: Page): Promise<Record<string, string[]>> {
  return page.evaluate(async () => {
    const result: Record<string, string[]> = {};
    for (const name of await caches.keys()) {
      result[name] = (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname);
    }
    return result;
  });
}

test.describe("application installable", () => {
  test("annonce un manifeste valide, avec ses icônes, et les couleurs de la marque", async ({ page, request }) => {
    await page.goto("/fr");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href).toBe("/manifest.webmanifest");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#12222e");

    const manifest = await (await request.get(href!)).json();
    expect(manifest).toMatchObject({ name: "Souq Autos", display: "standalone", start_url: "/", scope: "/" });
    for (const icon of manifest.icons) {
      const res = await request.get(icon.src);
      expect(res.status(), icon.src).toBe(200);
      expect(res.headers()["content-type"], icon.src).toContain("image/png");
    }
  });

  test("enregistre son service worker, qui contrôle la page à la visite suivante", async ({ page }) => {
    await page.goto("/fr");
    await waitForActiveWorker(page);
    const registration = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration("/");
      return { scope: r ? new URL(r.scope).pathname : null, script: r?.active ? new URL(r.active.scriptURL).pathname : null };
    });
    expect(registration).toEqual({ scope: "/", script: "/sw.js" });
  });

  test("le service worker est servi de façon à toujours être revérifié", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(res.headers()["content-type"]).toContain("javascript");
  });

  test("ne garde en cache que des fichiers statiques : jamais une page, jamais l'API", async ({ page }) => {
    await page.goto("/fr");
    await waitForActiveWorker(page);
    // des visites qui, si elles étaient mises en cache, révéleraient des données personnalisées
    await page.goto("/fr/connexion");
    await page.goto("/fr/recherche");
    await page.evaluate(() => fetch("/api/health").then((r) => r.json()));
    await page.evaluate(() => fetch("/api/auth/me").catch(() => null));

    const caches = await cachedPaths(page);
    const names = Object.keys(caches);
    expect(names).toEqual(["souq-static-v1"]);

    const paths = caches["souq-static-v1"];
    expect(paths).toEqual(expect.arrayContaining(["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"]));
    for (const p of paths) {
      const allowed = p === "/offline.html" || p.startsWith("/icons/") || p.startsWith("/_next/static/");
      expect(allowed, `chemin inattendu en cache : ${p}`).toBe(true);
    }
    expect(paths.some((p) => p.startsWith("/api/") || p.startsWith("/fr") || p.startsWith("/ar"))).toBe(false);
    expect(paths.some((p) => p.startsWith("/_next/static/"))).toBe(true); // les fichiers de l'application sont bien gardés
  });

  test("hors connexion, une page affiche la page prévue, en français et en arabe, puis tout redevient normal", async ({ page, context }) => {
    await page.goto("/fr");
    await waitForActiveWorker(page);

    await context.setOffline(true);
    await page.goto("/fr/recherche");
    await expect(page.getByRole("heading", { name: "Vous êtes hors connexion" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "أنت غير متصل بالإنترنت" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Réessayer/ })).toBeVisible();
    // la page hors connexion ne montre aucune donnée du site
    await expect(page.locator("body")).not.toContainText("annonces trouvées");

    await context.setOffline(false);
    await page.getByRole("button", { name: /Réessayer/ }).click();
    await expect(page).toHaveURL(/\/fr\/recherche/);
    await expect(page.getByRole("heading", { name: "Vous êtes hors connexion" })).toHaveCount(0);
    await expect(page.locator("main")).toBeVisible();
  });

  test("hors connexion, l'API n'est pas simulée : elle échoue vraiment, sans réponse enregistrée", async ({ page, context }) => {
    await page.goto("/fr");
    await waitForActiveWorker(page);
    await page.evaluate(() => fetch("/api/health").then((r) => r.json())); // réponse fraîche, connecté

    await context.setOffline(true);
    const outcome = await page.evaluate(async () => {
      try {
        const res = await fetch("/api/health");
        return `réponse ${res.status}`;
      } catch {
        return "échec réseau";
      }
    });
    expect(outcome).toBe("échec réseau");
  });

  test("ne propose pas d'installer une application déjà ouverte dans le navigateur sans invite", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.getByRole("button", { name: "Installer l'application" })).toHaveCount(0);
  });
});
