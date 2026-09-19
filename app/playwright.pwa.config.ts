import { defineConfig, devices } from "@playwright/test";
import { getE2eDatabaseUrl } from "./e2e/e2e-database";

// Lot 120 — tests de l'application installable (service worker, mode hors connexion).
//
// Séparés de la suite principale (playwright.config.ts) parce qu'ils exigent une version de
// PRODUCTION : le service worker n'est enregistré qu'en production (des fichiers aux noms
// stables mis en cache masqueraient les modifications en développement). Lancés par
// `npm run test:e2e:pwa` : compilation puis démarrage de production sur un port dédié, avec la
// base de test (jamais les données de démonstration).
const PORT = 5186;
const env = { DATABASE_URL: getE2eDatabaseUrl(), REDIS_URL: "", S3_BUCKET: "" };

export default defineConfig({
  testDir: "./e2e-pwa",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    env,
  },
});
