import { test, expect } from "@playwright/test";
import { uniqueAccount, registerAndLogin, generateTestPhoto } from "./fixtures";

// Le parcours le plus complexe et le plus touché du site : les 11 étapes de
// l'assistant de publication (src/app/[locale]/publier/etape-1 à etape-11),
// jusqu'à la publication réelle d'une annonce et sa présence confirmée sur
// sa propre fiche. Compte fraîchement inscrit (jamais un compte de
// démonstration partagé) pour ne jamais polluer les données existantes.
test("un vendeur peut publier une annonce de bout en bout via l'assistant en 11 étapes", async ({ page }) => {
  const seller = uniqueAccount("seller");
  await registerAndLogin(page, "fr", seller);

  const uniqueTitle = `Renault Clio E2E test ${Date.now()}`;

  // Étape 1 — intro, aucun champ.
  await page.goto("/fr/publier/etape-1");
  await page.getByRole("button", { name: "Suivant" }).click();

  // Étape 2 — catégorie / marque / modèle.
  await expect(page).toHaveURL(/etape-2/);
  const selects2 = page.locator("select");
  await selects2.nth(0).selectOption("VOITURE");
  await selects2.nth(1).selectOption({ label: "Renault" });
  await selects2.nth(2).selectOption({ label: "Clio" });
  await page.getByRole("button", { name: "Suivant" }).click();

  // Étape 3 — année / kilométrage / carburant / boîte.
  await expect(page).toHaveURL(/etape-3/);
  const numbers3 = page.locator('input[type="number"]');
  await numbers3.nth(0).fill("2019");
  await numbers3.nth(1).fill("50000");
  const selects3 = page.locator("select");
  await selects3.nth(0).selectOption("DIESEL");
  await selects3.nth(1).selectOption("MANUELLE");
  await page.getByRole("button", { name: "Suivant" }).click();

  // Étape 4 — état.
  await expect(page).toHaveURL(/etape-4/);
  await page.locator("select").nth(0).selectOption("OCCASION");
  await page.getByRole("button", { name: "Suivant" }).click();

  // Étape 5 — prix.
  await expect(page).toHaveURL(/etape-5/);
  await page.locator('input[type="number"]').fill("2200000");
  await page.getByRole("button", { name: "Suivant" }).click();

  // Étape 6 — photos (vraie image JPEG générée à la volée, même technique
  // que prisma/seed-demo-listings.ts).
  await expect(page).toHaveURL(/etape-6/);
  const photo = await generateTestPhoto();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "e2e-test-photo.jpg", mimeType: "image/jpeg", buffer: photo });
  await expect(page.locator("img")).toBeVisible();
  await page.getByRole("button", { name: "Suivant" }).click();

  // Étape 7 — titre / description.
  await expect(page).toHaveURL(/etape-7/);
  await page.locator("#wizard-title").fill(uniqueTitle);
  await page
    .locator("#wizard-description")
    .fill("Renault Clio en bon état général, entretien suivi. Annonce créée par la suite de tests E2E.");
  await page.getByRole("button", { name: "Suivant" }).click();

  // Étape 8 — wilaya / téléphone (compte fraîchement inscrit, sans
  // téléphone déjà enregistré : le champ est donc éditable).
  await expect(page).toHaveURL(/etape-8/);
  await page.locator("#wizard-wilaya").selectOption({ label: "Oran" });
  await page.locator("#wizard-phone").fill("0555123456");
  await page.getByRole("button", { name: "Suivant" }).click();

  // Étape 9 — prévisualisation, aucun champ requis.
  await expect(page).toHaveURL(/etape-9/);
  await expect(page.getByText(uniqueTitle)).toBeVisible();
  await page.getByRole("button", { name: "Suivant" }).click();

  // Étape 10 — formule (seule STANDARD est disponible, paiement non câblé —
  // cf. CHANGELOG.md, aucun choix à faire ici).
  await expect(page).toHaveURL(/etape-10/);
  await page.getByRole("button", { name: "Suivant" }).click();

  // Étape 11 — publication réelle.
  await expect(page).toHaveURL(/etape-11/);
  await page.getByRole("button", { name: "Publier l'annonce" }).click();

  // Redirection vers la vraie fiche annonce nouvellement créée. Le titre
  // apparaît à la fois dans le fil d'Ariane et le <h1> — on vérifie
  // spécifiquement le titre principal de la fiche.
  await expect(page).toHaveURL(/\/fr\/annonce\/.+\?published=1/);
  await expect(page.getByRole("heading", { name: uniqueTitle })).toBeVisible();
});
