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

// Lot 131 — l'inscription et la connexion sont limitées à 10 par quart d'heure et par adresse IP (src/app/api/auth/*).
// Tous les tests viennent de 127.0.0.1 : dès la onzième inscription de la suite, les suivantes seraient refusées (429),
// sans rapport avec ce que le test vérifie. Chaque navigateur de test annonce donc SA propre adresse dans
// X-Forwarded-For (le site, sans TRUSTED_PROXY_HOPS, en prend la première valeur, cf. src/lib/client-ip.ts) ; les limites
// restent actives et sont testées telles quelles, seulement réparties par navigateur comme elles le seraient par visiteur.
export async function giveOwnClientIp(page: Page): Promise<void> {
  const octet = () => 1 + Math.floor(Math.random() * 253);
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
}

export async function registerAndLogin(page: Page, locale: "fr" | "ar", account: NewAccount): Promise<void> {
  await giveOwnClientIp(page);
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
  await giveOwnClientIp(page);
  await page.goto(`/${locale}/connexion`);
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.locator("#login-email").locator("xpath=//ancestor::form").locator("button[type=submit]").click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/compte/tableau-de-bord`));
}
