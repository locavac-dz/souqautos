import { test, expect, type Page } from "@playwright/test";
import type { Prisma } from "@prisma/client";
import { uniqueAccount, registerAndLogin } from "./fixtures";
import { createListing } from "./api-helpers";
import { disconnectE2eDb, e2eDb } from "./db";

// Lot 131 — la recherche, contrôlée contre la VÉRITÉ DE LA BASE : le nombre de résultats affiché doit être exactement
// celui des annonces publiées qui satisfont le filtre, jamais une valeur écrite en dur dans le test. Les annonces en
// attente de modération n'apparaissent jamais.
test.afterAll(disconnectE2eDb);

async function shownCount(page: Page): Promise<number> {
  const text = await page.getByText(/annonces? trouvées?/).first().innerText();
  return Number(text.replace(/\D/g, ""));
}

// Liste principale des résultats : la dernière grille qui contient des cartes d'annonce (la liste « en avant » la précède ;
// le pied de page, lui aussi en grille, n'en contient aucune).
function mainList(page: Page) {
  return page.locator("div.grid").filter({ has: page.locator("a[href*='/annonce/']") }).last();
}

// Prix des annonces de la liste principale, dans l'ordre d'affichage.
async function listedPrices(page: Page): Promise<number[]> {
  const texts = await mainList(page).locator("a[href*='/annonce/']").locator("p.text-lg").allInnerTexts();
  return texts.map((t) => Number(t.replace(/\D/g, "")));
}

const published: Prisma.ListingWhereInput = { status: "PUBLIEE" };

test("le nombre de résultats est exactement celui des annonces publiées, sans filtre", async ({ page }) => {
  // Une annonce en attente de modération ne doit compter dans rien.
  await registerAndLogin(page, "fr", uniqueAccount("search"));
  await createListing(page, { title: `Annonce en attente exclue de la recherche ${Date.now()}`, publish: false });

  await page.goto("/fr/recherche");
  expect(await shownCount(page)).toBe(await e2eDb().listing.count({ where: published }));
});

test("chaque filtre renvoie exactement les annonces publiées de la base qui le satisfont", async ({ page }) => {
  const db = e2eDb();
  const renault = await db.brand.findFirstOrThrow({ where: { name: "Renault" } });
  const cases: { label: string; query: string; where: Prisma.ListingWhereInput }[] = [
    { label: "prix maximum", query: "priceMax=2200000", where: { price: { lte: 2_200_000 } } },
    { label: "prix minimum", query: "priceMin=3500000", where: { price: { gte: 3_500_000 } } },
    { label: "fourchette de prix", query: "priceMin=2000000&priceMax=3000000", where: { price: { gte: 2_000_000, lte: 3_000_000 } } },
    { label: "année minimum", query: "yearMin=2020", where: { year: { gte: 2020 } } },
    { label: "kilométrage maximum", query: "mileageMax=50000", where: { mileage: { lte: 50_000 } } },
    { label: "carburant", query: "fuelType=ESSENCE", where: { fuelType: "ESSENCE" } },
    { label: "boîte automatique", query: "gearbox=AUTOMATIQUE", where: { gearbox: "AUTOMATIQUE" } },
    { label: "marque", query: `brandId=${renault.id}`, where: { brandId: renault.id } },
    { label: "catégorie voiture", query: "category=VOITURE", where: { category: "VOITURE" } },
    { label: "combinaison", query: `brandId=${renault.id}&fuelType=DIESEL&yearMin=2018`, where: { brandId: renault.id, fuelType: "DIESEL", year: { gte: 2018 } } },
  ];

  for (const { label, query, where } of cases) {
    await page.goto(`/fr/recherche?${query}`);
    const expected = await db.listing.count({ where: { ...published, ...where } });
    expect(await shownCount(page), label).toBe(expected);
    expect(expected, `${label} : le cas ne teste rien s'il ne trouve aucune annonce`).toBeGreaterThan(0);
  }
});

test("le tri par prix range la liste dans l'ordre croissant puis décroissant", async ({ page }) => {
  await page.goto("/fr/recherche?sort=price_asc");
  const ascending = await listedPrices(page);
  expect(ascending.length).toBeGreaterThan(5);
  expect(ascending).toEqual([...ascending].sort((a, b) => a - b));

  await page.goto("/fr/recherche?sort=price_desc");
  const descending = await listedPrices(page);
  expect(descending).toEqual([...descending].sort((a, b) => b - a));
  expect(descending[0]).toBeGreaterThan(ascending[0]);
});

test("un filtre de prix n'affiche que des annonces dans la fourchette", async ({ page }) => {
  await page.goto("/fr/recherche?priceMin=2000000&priceMax=3000000&sort=price_asc");
  const prices = await listedPrices(page);
  expect(prices.length).toBeGreaterThan(0);
  for (const price of prices) {
    expect(price).toBeGreaterThanOrEqual(2_000_000);
    expect(price).toBeLessThanOrEqual(3_000_000);
  }
});

test("la pagination affiche 20 annonces par page, sans répéter une annonce d'une page à l'autre", async ({ page }) => {
  const total = await e2eDb().listing.count({ where: published });
  test.skip(total <= 20, "moins de 21 annonces publiées : pas de deuxième page");

  // Liste principale seulement : les annonces « en avant » (Premium) sont répétées en tête de chaque page, volontairement.
  const idsOn = async (n: number) => {
    await page.goto(`/fr/recherche?page=${n}&sort=price_asc`);
    return mainList(page).locator("a[href*='/annonce/']").evaluateAll((links) => links.map((l) => (l as HTMLAnchorElement).getAttribute("href")));
  };
  const first = await idsOn(1);
  await expect(page.getByText(new RegExp(`Page 1 / ${Math.ceil(total / 20)}`))).toBeVisible();
  expect(first).toHaveLength(20);
  const second = await idsOn(2);
  await expect(page.getByText(new RegExp(`Page 2 / ${Math.ceil(total / 20)}`))).toBeVisible();
  expect(second.length).toBeGreaterThan(0);
  expect(first.filter((href) => second.includes(href))).toEqual([]);
});

test("une recherche sans résultat le dit, et des valeurs extrêmes ou hostiles ne cassent pas la page", async ({ page }) => {
  await page.goto("/fr/recherche?q=zzzz-aucune-annonce-ne-porte-ce-nom");
  await expect(page.getByText("Aucune annonce ne correspond à votre recherche.")).toBeVisible();
  expect(await shownCount(page)).toBe(0);

  page.on("dialog", () => {
    throw new Error("un script injecté dans la recherche s'est exécuté");
  });
  for (const query of ["brandId=abc", "priceMax=99999999999", "page=-5", "sort=n-importe-quoi", "yearMin=1", "modelId=99999999999", "q=%3Cscript%3Ealert(1)%3C%2Fscript%3E", "q=%27%3B+DROP+TABLE+%22Listing%22%3B--"]) {
    const response = await page.goto(`/fr/recherche?${query}`);
    expect(response?.status(), query).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }), query).toBeVisible();
  }
  // Le texte cherché est affiché tel quel dans le champ, jamais interprété comme du HTML.
  await page.goto("/fr/recherche?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
  await expect(page.locator("script", { hasText: "alert(1)" })).toHaveCount(0);
});

test("on filtre par catégorie et par marque depuis le panneau : l'adresse et les résultats suivent", async ({ page }) => {
  await page.goto("/fr/recherche");
  await page.locator("#filter-category").selectOption("VOITURE");
  await page.locator("#filter-brand").selectOption({ label: "Renault" });
  await page.getByRole("button", { name: "Rechercher" }).last().click();

  await expect(page).toHaveURL(/category=VOITURE/);
  await expect(page).toHaveURL(/brandId=\d+/);
  const cards = mainList(page).locator("a[href*='/annonce/']");
  expect(await cards.count()).toBeGreaterThan(0);
  for (const text of await cards.allInnerTexts()) expect(text).toContain("Renault");

  // Les filtres choisis restent affichés après le rechargement de la page.
  await expect(page.locator("#filter-category")).toHaveValue("VOITURE");
  await expect(page.locator("#filter-brand option:checked")).toHaveText("Renault");
});

test("une moto publiée n'apparaît que dans la catégorie « Deux-roues », et pas parmi les voitures", async ({ page }) => {
  await registerAndLogin(page, "fr", uniqueAccount("moto"));
  const title = `Yamaha MT-07 recherche par catégorie ${Date.now()}`;
  await createListing(page, { category: "DEUX_ROUES", brand: "Yamaha", model: "MT-07", title });

  await page.goto("/fr/recherche?category=DEUX_ROUES");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  expect(await shownCount(page)).toBe(await e2eDb().listing.count({ where: { ...published, category: "DEUX_ROUES" } }));

  await page.goto("/fr/recherche?category=VOITURE");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toHaveCount(0);
});
