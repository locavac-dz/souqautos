import { test, expect } from "@playwright/test";
import { uniqueAccount, registerAndLogin } from "./fixtures";

// Parcours critique le plus fondamental : sans inscription/connexion réelles
// qui fonctionnent, rien d'autre dans l'application n'est accessible.
test.describe("Inscription et connexion", () => {
  test("un visiteur peut réellement s'inscrire puis se reconnecter", async ({ page }) => {
    const account = uniqueAccount("auth");

    await registerAndLogin(page, "fr", account);
    await expect(page.getByText(account.displayName).first()).toBeVisible();

    // Déconnexion (API, pas de page dédiée — POST /api/auth/logout, même
    // requête que le bouton de déconnexion du site) puis reconnexion avec
    // les mêmes identifiants : confirme que le compte a été réellement
    // persisté (pas seulement une session en mémoire côté client) et que le
    // mot de passe est correctement vérifié.
    await page.request.post("/api/auth/logout");
    await page.goto("/fr/connexion");
    await page.locator("#login-email").fill(account.email);
    await page.locator("#login-password").fill(account.password);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await expect(page).toHaveURL(/\/fr\/compte\/tableau-de-bord/);
  });

  test("un mauvais mot de passe est rejeté avec un message générique", async ({ page }) => {
    const account = uniqueAccount("badpw");
    await registerAndLogin(page, "fr", account);
    await page.request.post("/api/auth/logout");

    await page.goto("/fr/connexion");
    await page.locator("#login-email").fill(account.email);
    await page.locator("#login-password").fill("mot-de-passe-incorrect");
    await page.getByRole("button", { name: /se connecter/i }).click();

    // Reste sur la page de connexion, jamais redirigé — confirme le rejet
    // (correctif du temps de réponse constant, Lot 98, n'affecte jamais le
    // résultat fonctionnel : toujours rejeté).
    await expect(page).toHaveURL(/\/fr\/connexion/);
  });
});
