import { test, expect, type Page } from "@playwright/test";
import { uniqueAccount, registerAndLogin } from "./fixtures";
import { createListing } from "./api-helpers";
import { disconnectE2eDb, e2eDb, makeAdmin } from "./db";
import fr from "../messages/fr.json";

// Lot 131 — l'espace d'administration : qui y entre, ce que voit chaque rôle, chaque écran s'ouvre sans erreur (dans les
// deux langues pour les plus récents), la modération d'une annonce de bout en bout, le journal d'audit et la mesure d'audience.
test.afterAll(disconnectE2eDb);

const ADMIN_PAGES = [
  "/admin",
  "/admin/annonces",
  "/admin/utilisateurs",
  "/admin/signalements",
  "/admin/avis",
  "/admin/avis-proprietaires",
  "/admin/pro",
  "/admin/identite",
  "/admin/referentiels",
  "/admin/statistiques",
  "/admin/audience",
  "/admin/parametres",
  "/admin/journal",
  "/admin/paiements",
  "/admin/mag",
  "/admin/mag/nouveau",
  "/admin/essais",
  "/admin/essais/nouveau",
  "/admin/guides",
  "/admin/guides/nouveau",
  "/admin/editorial",
  "/admin/revue-de-presse",
  "/admin/revue-de-presse/nouveau",
];

async function loginAsAdmin(page: Page, prefix: string) {
  const account = uniqueAccount(prefix);
  await registerAndLogin(page, "fr", account);
  await makeAdmin(account.email);
  return account;
}

test.describe("accès à l'administration", () => {
  test("un visiteur est renvoyé vers la connexion, un compte ordinaire vers l'accueil, et aucun des deux ne voit le moindre contenu", async ({ browser }) => {
    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();
    for (const path of ["/fr/admin", "/fr/admin/journal", "/fr/admin/referentiels", "/fr/admin/guides/nouveau"]) {
      await anonymousPage.goto(path);
      await expect(anonymousPage, path).toHaveURL(/\/fr\/connexion/);
    }
    await anonymous.close();

    const member = await browser.newContext();
    const memberPage = await member.newPage();
    await registerAndLogin(memberPage, "fr", uniqueAccount("membre-admin"));
    for (const path of ["/fr/admin", "/fr/admin/journal", "/fr/admin/utilisateurs", "/fr/admin/referentiels"]) {
      await memberPage.goto(path);
      await expect(memberPage, path).not.toHaveURL(/\/admin/);
      await expect(memberPage.getByText(fr.Admin.dashboardTitle), path).toHaveCount(0);
    }
    await member.close();
  });

  test("un modérateur consulte l'administration mais ne peut ni modifier le catalogue, ni écrire dans les API réservées aux administrateurs", async ({ page }) => {
    const account = uniqueAccount("moderateur");
    await registerAndLogin(page, "fr", account);
    await e2eDb().user.update({ where: { email: account.email }, data: { role: "MODERATEUR" } });

    await page.goto("/fr/admin/annonces");
    await expect(page.getByRole("link", { name: fr.Admin.dashboardTitle })).toBeVisible();

    // Catalogue : lecture seule (pas de formulaire d'ajout), et l'API refuse.
    await page.goto("/fr/admin/referentiels");
    await expect(page.getByRole("heading", { level: 1, name: fr.AdminCatalogue.title })).toBeVisible();
    await expect(page.getByRole("button", { name: fr.AdminCatalogue.addBrandAction })).toHaveCount(0);
    const brand = await page.request.post("/api/admin/brands", { data: { name: "Marque refusée E2E" } });
    expect(brand.status()).toBe(403);
    const article = await page.request.post("/api/admin/blog", { data: {} });
    expect(article.status()).toBe(403);
    expect(await e2eDb().brand.count({ where: { name: "Marque refusée E2E" } })).toBe(0);
  });
});

test.describe("écrans d'administration", () => {
  test("chaque écran s'ouvre pour un administrateur, avec un titre et sans erreur", async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsAdmin(page, "admin-pages");
    const problems: string[] = [];
    let current = "";
    page.on("pageerror", (error) => problems.push(`${current} : exception ${error.message}`));
    page.on("console", (message) => {
      const text = message.text();
      if (message.type() === "error" && !/favicon|Download the React DevTools|status of 404/.test(text)) problems.push(`${current} : console.error ${text.slice(0, 140)}`);
    });

    for (const path of ADMIN_PAGES) {
      current = path;
      const response = await page.goto(`/fr${path}`);
      if (response?.status() !== 200) problems.push(`${path} : statut ${response?.status()}`);
      if ((await page.locator("h1").count()) === 0) problems.push(`${path} : aucun titre h1`);
      if (/\/connexion/.test(page.url()) || page.url().replace(/\/$/, "").endsWith("/fr")) problems.push(`${path} : redirigé vers ${page.url()}`);
    }
    expect(problems).toEqual([]);
  });

  test("les écrans récents s'affichent aussi en arabe, de droite à gauche, sans débordement sur téléphone", async ({ page }) => {
    await loginAsAdmin(page, "admin-ar");
    const problems: string[] = [];
    for (const path of ["/admin/audience", "/admin/editorial", "/admin/guides", "/admin/referentiels", "/admin/journal"]) {
      const response = await page.goto(`/ar${path}`);
      if (response?.status() !== 200) problems.push(`${path} : statut ${response?.status()}`);
      if ((await page.locator("html").getAttribute("dir")) !== "rtl") problems.push(`${path} : pas de droite à gauche`);
      await page.setViewportSize({ width: 375, height: 812 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) problems.push(`${path} : déborde de ${overflow}px sur 375px`);
      await page.setViewportSize({ width: 1280, height: 800 });
    }
    expect(problems).toEqual([]);
  });

  test("le rythme éditorial présente les quatre rubriques", async ({ page }) => {
    await loginAsAdmin(page, "admin-edito");
    await page.goto("/fr/admin/editorial");
    for (const key of ["section_press", "section_roadTests", "section_magazine", "section_guides"] as const) {
      await expect(page.getByText(fr.AdminEditorial[key]).first()).toBeVisible();
    }
  });
});

test.describe("modération d'une annonce", () => {
  test("une annonce publiée par un vendeur reste invisible jusqu'à son approbation, puis devient publique", async ({ browser, page }) => {
    const seller = uniqueAccount("vendeur-modere");
    await registerAndLogin(page, "fr", seller);
    const { id, title } = await createListing(page, { publish: false });
    expect((await e2eDb().listing.findUniqueOrThrow({ where: { id } })).status).toBe("EN_ATTENTE");

    // Invisible du public.
    const visitor = await browser.newContext();
    const visitorPage = await visitor.newPage();
    expect((await visitorPage.goto(`/fr/annonce/${id}`))?.status()).toBe(404);
    await visitorPage.goto(`/fr/recherche?q=${encodeURIComponent(title)}`);
    await expect(visitorPage.getByText(title)).toHaveCount(0);

    // Un administrateur l'approuve depuis l'écran de modération.
    const admin = await browser.newContext();
    const adminPage = await admin.newPage();
    await loginAsAdmin(adminPage, "moderateur-approuve");
    await adminPage.goto("/fr/admin/annonces");
    const row = adminPage.locator("li, tr, div").filter({ hasText: title }).filter({ has: adminPage.getByRole("button", { name: fr.Admin.approve }) }).last();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: fr.Admin.approve }).click();
    await expect.poll(async () => (await e2eDb().listing.findUniqueOrThrow({ where: { id } })).status, { timeout: 15_000 }).toBe("PUBLIEE");

    // Publique, et trouvable.
    expect((await visitorPage.goto(`/fr/annonce/${id}`))?.status()).toBe(200);
    await visitorPage.goto(`/fr/recherche?q=${encodeURIComponent(title)}`);
    await expect(visitorPage.getByRole("link", { name: new RegExp(title) }).first()).toBeVisible();

    // L'action est tracée dans le journal d'audit, avec l'administrateur qui l'a faite.
    await expect.poll(() => e2eDb().auditLog.count({ where: { targetId: id } }), { timeout: 10_000 }).toBeGreaterThan(0);
    await visitor.close();
    await admin.close();
  });
});

test.describe("journal d'audit et mesure d'audience", () => {
  test("une modification du catalogue est tracée dans le journal, visible dans l'écran du journal", async ({ page }) => {
    await loginAsAdmin(page, "admin-journal");
    const yamaha = await e2eDb().brand.findFirstOrThrow({ where: { name: "Yamaha" } });
    const name = `ZZ Journal E2E ${Date.now()}`;
    const created = await page.request.post(`/api/admin/brands/${yamaha.id}/models`, { data: { name, categories: ["DEUX_ROUES"] } });
    expect(created.status()).toBe(201);
    const modelId = String((await created.json()).model.id);

    const entry = await e2eDb().auditLog.findFirstOrThrow({ where: { action: "model.create", targetId: modelId } });
    expect(entry.details).toContain(name);
    expect(entry.details).toContain("DEUX_ROUES");

    await page.goto("/fr/admin/journal");
    await expect(page.getByText("model.create").first()).toBeVisible();
  });

  test("l'écran d'audience affiche les visites réellement comptées", async ({ page, request }) => {
    await loginAsAdmin(page, "admin-audience");
    const before = (await e2eDb().pageViewDay.aggregate({ where: { page: "/mag" }, _sum: { count: true } }))._sum.count ?? 0;
    const beacon = await request.post("/api/analytics/collect", {
      data: JSON.stringify({ path: "/fr/mag", referrer: "" }),
      headers: { "content-type": "text/plain", "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" },
    });
    expect(beacon.status()).toBe(204);
    await expect.poll(async () => (await e2eDb().pageViewDay.aggregate({ where: { page: "/mag" }, _sum: { count: true } }))._sum.count ?? 0, { timeout: 15_000 }).toBeGreaterThan(before);

    await page.goto("/fr/admin/audience");
    await expect(page.getByRole("heading", { level: 1, name: fr.Audience.title })).toBeVisible();
    await expect(page.getByText(fr.Audience.empty)).toHaveCount(0);
    await expect(page.getByText(fr.Audience.topPages)).toBeVisible();
    await expect(page.getByText("/mag").first()).toBeVisible();
  });
});
