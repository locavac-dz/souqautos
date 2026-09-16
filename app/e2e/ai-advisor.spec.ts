import { test, expect } from "@playwright/test";
import { loginAs, DEMO_SELLER } from "./fixtures";

// Reprend les requêtes déjà vérifiées manuellement en conditions réelles
// cette session (chemin heuristique — aucune clé Anthropic disponible, ici
// comme partout ailleurs dans le projet).
test.describe("Conseiller IA", () => {
  test("recherche en français avec plusieurs critères", async ({ page }) => {
    await loginAs(page, "fr", DEMO_SELLER.email, DEMO_SELLER.password);
    await page.goto("/fr/compte/assistant-achat");

    await page.getByRole("textbox").fill("une Renault Clio diesel manuelle à Oran, moins de 3 millions");
    await page.getByRole("button", { name: "Envoyer" }).click();

    await expect(page.getByText("Renault Clio 2018")).toBeVisible();
  });

  // Exerce spécifiquement le correctif d'accord féminin arabe (Lot 100) :
  // "أوتوماتيكية" (féminin, accord avec "سيارة") doit être reconnu, pas
  // seulement la forme masculine "أوتوماتيكي".
  test("recherche en arabe avec accord féminin (carburant/boîte)", async ({ page }) => {
    await loginAs(page, "ar", DEMO_SELLER.email, DEMO_SELLER.password);
    await page.goto("/ar/compte/assistant-achat");

    await page.getByRole("textbox").fill("سيارة أوتوماتيكية في الجزائر");
    await page.getByRole("button", { name: "إرسال" }).click();

    await expect(page.getByText(/BMW Série 3|Hyundai Tucson|Mercedes-Benz Classe C/).first()).toBeVisible();
  });
});
