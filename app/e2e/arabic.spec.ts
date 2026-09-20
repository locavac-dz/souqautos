import { test, expect } from "@playwright/test";
import { uniqueAccount, registerAndLogin } from "./fixtures";
import { createListing } from "./api-helpers";
import { disconnectE2eDb, e2eDb } from "./db";
import ar from "../messages/ar.json";

// Lot 131 — les parcours principaux dans la version ARABE du site (jusqu'ici, seul le français était testé de bout en
// bout) : inscription, publication, recherche, fiche d'une annonce et contact. Les textes attendus sont lus dans
// messages/ar.json, jamais recopiés : le test suit le fichier de traduction. Ces tests vérifient que les écrans
// fonctionnent en arabe et de droite à gauche ; ils ne jugent pas la qualité de la traduction (voir `npm run i18n:review`).
test.afterAll(disconnectE2eDb);

// Un message ICU « {count} annonces trouvées » devient une expression qui reconnaît n'importe quel nombre.
function messagePattern(message: string, variable: string): RegExp {
  const escaped = message.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
  return new RegExp(escaped.replace(`\\{${variable}\\}`, "[\\d\\s\\u00a0\\u202f.,٠-٩]+"));
}

test("un visiteur s'inscrit en arabe et arrive sur son tableau de bord, de droite à gauche", async ({ page }) => {
  const account = uniqueAccount("arabe");
  await registerAndLogin(page, "ar", account);
  await expect(page).toHaveURL(/\/ar\/compte\/tableau-de-bord/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText(account.displayName).first()).toBeVisible();
});

test("l'assistant de publication en arabe : catégories en arabe, marques filtrées par catégorie", async ({ page }) => {
  await registerAndLogin(page, "ar", uniqueAccount("arabe-publier"));
  await page.goto("/ar/publier/etape-2");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  const selects = page.locator("select");
  const categoryLabels = (await selects.nth(0).locator("option").allTextContents()).map((t) => t.trim());
  for (const key of ["categoryVoiture", "categoryUtilitaire", "categoryPoidsLourd", "categoryDeuxRoues", "categoryAutre"] as const) {
    expect(categoryLabels, key).toContain(ar.Wizard[key]);
  }

  await selects.nth(0).selectOption("DEUX_ROUES");
  const brands = (await selects.nth(1).locator("option").allTextContents()).map((t) => t.trim());
  expect(brands).toContain("Yamaha");
  expect(brands).not.toContain("Renault");
  await selects.nth(1).selectOption({ label: "Yamaha" });
  await expect(selects.nth(2)).toBeVisible();
  expect((await selects.nth(2).locator("option").allTextContents()).map((t) => t.trim())).toContain("MT-07");
});

test("la recherche en arabe : compteur en arabe, filtres et résultats cohérents avec la base", async ({ page }) => {
  await page.goto("/ar/recherche");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText(messagePattern(ar.Search.resultsCount, "count")).first()).toBeVisible();

  await page.goto("/ar/recherche?priceMax=2200000");
  const text = await page.getByText(messagePattern(ar.Search.resultsCount, "count")).first().innerText();
  const shown = Number(text.replace(/[^\d٠-٩]/g, "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
  expect(shown).toBe(await e2eDb().listing.count({ where: { status: "PUBLIEE", price: { lte: 2_200_000 } } }));

  await page.goto("/ar/recherche?q=zzzz-aucune-annonce-ne-porte-ce-nom");
  await expect(page.getByText(ar.Search.noResults)).toBeVisible();
});

test("la fiche d'une annonce en arabe : affichage du numéro à la demande, en arabe", async ({ page, browser }) => {
  await registerAndLogin(page, "fr", uniqueAccount("vendeur-arabe"));
  const { id, phone, title } = await createListing(page);

  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/ar/annonce/${id}`);
  await expect(visitorPage.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(visitorPage.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(visitorPage.getByText(phone)).toHaveCount(0);

  await visitorPage.getByRole("button", { name: ar.Contact.showPhone }).click();
  await expect(visitorPage.getByRole("link", { name: ar.Contact.call.replace("{phone}", phone) })).toBeVisible();
  await visitor.close();
});

test("les pages de connexion et d'inscription en arabe s'affichent de droite à gauche et connectent réellement", async ({ page }) => {
  const account = uniqueAccount("arabe-connexion");
  await registerAndLogin(page, "ar", account);
  await page.request.post("/api/auth/logout");

  await page.goto("/ar/connexion");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.locator("#login-email").fill(account.email);
  await page.locator("#login-password").fill(account.password);
  await page.locator("#login-email").locator("xpath=//ancestor::form").locator("button[type=submit]").click();
  await expect(page).toHaveURL(/\/ar\/compte\/tableau-de-bord/);
});
