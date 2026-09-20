import { test, expect } from "@playwright/test";
import { uniqueAccount, registerAndLogin, generateTestPhoto } from "./fixtures";

// Lot 130 — le catalogue couvre voitures, utilitaires, poids lourds et deux-roues. Ces parcours vérifient, sur le
// vrai site et la vraie base : l'index filtré par famille, l'assistant de publication qui ne propose que les marques
// et modèles de la catégorie choisie, et l'API qui refuse une combinaison incohérente (une moto « voiture »).

test("l'index du catalogue se filtre par famille de véhicules", async ({ page }) => {
  await page.goto("/fr/voitures?categorie=deux-roues");
  await expect(page.getByRole("link", { name: /^Yamaha/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Renault/ })).toHaveCount(0);

  await page.goto("/fr/voitures?categorie=poids-lourd");
  await expect(page.getByRole("link", { name: /^Scania/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Yamaha/ })).toHaveCount(0);

  // Renault vend des voitures ET des utilitaires : présent dans les deux familles.
  await page.goto("/fr/voitures?categorie=utilitaire");
  await expect(page.getByRole("link", { name: /^Renault Voitures · Utilitaires/ })).toBeVisible();

  // Un lien mal formé n'est pas une erreur : il affiche tout le catalogue.
  await page.goto("/fr/voitures?categorie=n-importe-quoi");
  await expect(page.getByRole("link", { name: /^Yamaha/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Renault Voitures/ })).toBeVisible();
});

test("l'assistant de publication ne propose que les marques et modèles de la catégorie choisie", async ({ page }) => {
  await registerAndLogin(page, "fr", uniqueAccount("cat"));
  await page.goto("/fr/publier/etape-2");
  const selects = page.locator("select");
  const brandNames = async () => (await selects.nth(1).locator("option").allTextContents()).map((t) => t.trim());

  await selects.nth(0).selectOption("DEUX_ROUES");
  expect(await brandNames()).toContain("Yamaha");
  expect(await brandNames()).not.toContain("Renault");

  await selects.nth(1).selectOption({ label: "Yamaha" });
  await selects.nth(2).selectOption({ label: "MT-07" });

  // Repasser en « Voiture » efface la marque devenue impossible, au lieu de la garder en silence.
  await selects.nth(0).selectOption("VOITURE");
  await expect(selects.nth(1)).toHaveValue("");
  expect(await brandNames()).toContain("Renault");
  expect(await brandNames()).not.toContain("Yamaha");

  // Un utilitaire : Renault ne propose que ses fourgons et le Kangoo, pas la Clio.
  await selects.nth(0).selectOption("UTILITAIRE");
  await selects.nth(1).selectOption({ label: "Renault" });
  const models = (await selects.nth(2).locator("option").allTextContents()).map((t) => t.trim());
  expect(models).toEqual(expect.arrayContaining(["Kangoo", "Master", "Trafic"]));
  expect(models).not.toContain("Clio");
});

test("l'API refuse une marque ou un modèle absent de la catégorie annoncée, et accepte le bon", async ({ page }) => {
  await registerAndLogin(page, "fr", uniqueAccount("catapi"));
  await page.goto("/fr/publier/etape-2");
  const selects = page.locator("select");
  await selects.nth(0).selectOption("DEUX_ROUES");
  await selects.nth(1).selectOption({ label: "Yamaha" });
  await selects.nth(2).selectOption({ label: "MT-07" });
  const brandId = Number(await selects.nth(1).inputValue());
  const modelId = Number(await selects.nth(2).inputValue());
  const photo = await generateTestPhoto();

  const post = (category: string) =>
    page.request.post("/api/listings", {
      multipart: {
        data: JSON.stringify({
          category,
          brandId,
          modelId,
          title: `Yamaha MT-07 test catégorie ${Date.now()}`,
          description: "Moto en très bon état, entretien suivi, aucun accident, vendue par son propriétaire.",
          price: 1200000,
          year: 2021,
          mileage: 15000,
          fuelType: "ESSENCE",
          gearbox: "MANUELLE",
          condition: "OCCASION",
          wilayaId: 16,
          phone: "05" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0"),
          equipmentIds: [],
        }),
        photos: { name: "photo.jpg", mimeType: "image/jpeg", buffer: photo },
      },
    });

  const wrong = await post("VOITURE");
  expect(wrong.status()).toBe(400);
  expect(await wrong.json()).toEqual({ error: "wrong_category" });

  const right = await post("DEUX_ROUES");
  expect(right.status()).toBe(201);
});
