import { defineConfig, devices } from "@playwright/test";

// Port et base de données dédiés, distincts du serveur de dev habituel
// (5184, prisma/dev.db) — un `npm run dev` manuel en parallèle ne doit
// jamais pouvoir être confondu avec le serveur de test, ni risquer de
// pointer Playwright vers les vraies données de démonstration (Lot 101).
const PORT = 5185;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  // Une seule base de données partagée par tous les specs (prisma/e2e.db) —
  // un seul worker pour éviter toute course entre eux (ex. deux specs qui
  // créeraient une annonce en même temps et se disputeraient la limite de
  // débit en mémoire). Suffisant pour la taille actuelle de la suite.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  // La base de test (prisma/e2e.db) est réinitialisée par le hook npm
  // `pretest:e2e` (package.json, exécute e2e/reset-db.ts) AVANT que
  // `playwright test` ne démarre quoi que ce soit — jamais via l'option
  // `globalSetup` de Playwright, qui exécute son propre `webServer` avant
  // les scripts globalSetup dans cette version (bug trouvé en écrivant ce
  // lot, cf. commentaire détaillé dans e2e/reset-db.ts).
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    // REDIS_URL/S3_BUCKET explicitement vidées : Next.js charge .env tel
    // quel (dotenv n'écrase jamais une variable déjà définie, mais complète
    // les absentes), et ce poste a un vrai Redis local qui tourne pour la
    // vérification manuelle — sans cette ligne, le rate limiting de ce
    // serveur de test se retrouvait réellement backé par Redis, partagé et
    // persistant entre deux exécutions de la suite, causant des échecs
    // intermittents par épuisement de quota (trouvé en écrivant ce lot).
    // Repli mémoire honnête forcé, comme prévu.
    env: { DATABASE_URL: "file:./e2e.db", REDIS_URL: "", S3_BUCKET: "" },
  },
});
