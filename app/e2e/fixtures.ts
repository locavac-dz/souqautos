import { randomUUID } from "crypto";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import sharp from "sharp";

// Comptes de démonstration réels du seed (prisma/seed-demo-listings.ts) —
// mêmes identifiants utilisés manuellement tout au long du projet, réutilisés
// ici quand un test a seulement besoin d'un compte déjà prêt avec des
// annonces existantes (jamais pour créer/modifier des données : un compte
// fraîchement inscrit sert à ça, cf. registerAndLogin ci-dessous).
export const DEMO_SELLER = { email: "yasmine.cherif@example.dz", password: "DemoVendeur2026!" };
// Vendeur de la Renault Clio 2018 (prisma/seed-demo-listings.ts) — même mot
// de passe partagé par tous les comptes de démonstration.
export const DEMO_SELLER_KARIM = { email: "karim.boudiaf@example.dz", password: "DemoVendeur2026!" };

export type NewAccount = { displayName: string; email: string; password: string };

// Email réellement unique par appel — deux tests (voire deux exécutions de
// la suite sur la même base si `global-setup` n'a pas tourné) ne peuvent
// jamais entrer en collision sur l'unicité de l'email.
export function uniqueAccount(prefix: string): NewAccount {
  const id = randomUUID().slice(0, 8);
  return {
    displayName: `Test ${prefix} ${id}`,
    email: `e2e-${prefix}-${id}@example.dz`,
    password: "MotDePasseTest2026!",
  };
}

export async function registerAndLogin(page: Page, locale: "fr" | "ar", account: NewAccount): Promise<void> {
  await page.goto(`/${locale}/inscription`);
  await page.locator("#register-name").fill(account.displayName);
  await page.locator("#register-email").fill(account.email);
  await page.locator("#register-password").fill(account.password);
  await page.locator("#register-name").locator("xpath=//ancestor::form").locator("button[type=submit]").click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/compte/tableau-de-bord`));
}

// Même technique que prisma/seed-demo-listings.ts (generatePlaceholderPhoto)
// pour une vraie image JPEG valide à uploader dans les tests, jamais un
// fichier bidon qui échouerait la validation magic-bytes côté serveur
// (src/lib/uploads.ts).
export async function generateTestPhoto(): Promise<Buffer> {
  return sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 90, g: 110, b: 160 } } })
    .jpeg()
    .toBuffer();
}

export async function loginAs(page: Page, locale: "fr" | "ar", email: string, password: string): Promise<void> {
  await page.goto(`/${locale}/connexion`);
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.locator("#login-email").locator("xpath=//ancestor::form").locator("button[type=submit]").click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/compte/tableau-de-bord`));
}
