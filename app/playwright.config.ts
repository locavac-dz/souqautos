import { defineConfig, devices } from "@playwright/test";
import { getE2eDatabaseUrl } from "./e2e/e2e-database";

// Port et base de données dédiés, distincts du serveur de dev habituel
// (5184, DATABASE_URL) — un `npm run dev` manuel en parallèle ne doit
// jamais pouvoir être confondu avec le serveur de test, ni risquer de
// pointer Playwright vers les vraies données de démonstration (Lot 101).
// La base de test est E2E_DATABASE_URL (PostgreSQL depuis le Lot 109).
const PORT = 5185;

export default defineConfig({
  testDir: "./e2e",
  // Lot 133 — 60 s par test (30 s auparavant) : le serveur de test est un `next dev` démarré à froid, qui compile chaque page
  // à sa première visite ; le premier test de la suite (écrans d'administration) dépassait 30 s sans aucun défaut du site.
  timeout: 60_000,
  // Lot 131 — attente des vérifications (URL, texte visible) : 15 s au lieu de 5 s. Le serveur de test est un `next dev`
  // qui compile chaque page à sa première visite ; sur une machine chargée, cela dépasse 5 s sans qu'il y ait le moindre
  // défaut (constaté sur l'étape 6 de l'assistant de publication). Un vrai défaut échoue toujours, seulement 10 s plus tard.
  expect: { timeout: 15_000 },
  // Une seule base de données partagée par tous les specs (E2E_DATABASE_URL) —
  // un seul worker pour éviter toute course entre eux (ex. deux specs qui
  // créeraient une annonce en même temps et se disputeraient la limite de
  // débit en mémoire). Suffisant pour la taille actuelle de la suite.
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: "list",
  // La base de test (E2E_DATABASE_URL) est réinitialisée par le hook npm
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
  webServer: [
    // Lot 132 — faux serveur Google (e2e/mock-google.mjs) pour tester « Continuer avec Google » sans dépendre de Google.
    {
      command: "node e2e/mock-google.mjs",
      url: "http://localhost:5187/__health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    // Lot 133 — faux serveur SMTP (e2e/mock-smtp.mjs) : reçoit les courriels du site pour que les tests les lisent.
    {
      command: "node e2e/mock-smtp.mjs",
      url: "http://localhost:5189/__health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
    command: `npx next dev --webpack -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    // REDIS_URL/S3_BUCKET explicitement vidées : Next.js charge .env tel
    // quel (dotenv n'écrase jamais une variable déjà définie, mais complète
    // les absentes), et ce poste a un vrai Redis local qui tourne pour la
    // vérification manuelle — sans cette ligne, le rate limiting de ce
    // serveur de test se retrouvait réellement backé par Redis, partagé et
    // persistant entre deux exécutions de la suite, causant des échecs
    // intermittents par épuisement de quota (trouvé en écrivant ce lot).
    // Repli mémoire honnête forcé, comme prévu.
    env: {
      DATABASE_URL: getE2eDatabaseUrl(),
      REDIS_URL: "",
      S3_BUCKET: "",
      // Lot 132 — connexion Google activée sur le faux serveur, avec des identifiants FACTICES ; l'adresse du site est celle du
      // serveur de test (l'adresse de retour de Google en est déduite).
      GOOGLE_CLIENT_ID: "e2e-client.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "e2e-secret-factice",
      GOOGLE_OAUTH_TEST_BASE_URL: "http://localhost:5187",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      // Lot 133 — les courriels du site partent vers le faux serveur SMTP (identifiants vidés : pas d'authentification).
      SMTP_HOST: "localhost",
      SMTP_PORT: "5188",
      SMTP_SECURE: "false",
      SMTP_USER: "",
      SMTP_PASS: "",
      SMTP_FROM: "Souq Autos <test@example.dz>",
      // Lot 143 — le cache de réactivité des cartes de résultats (5 min par défaut) est DÉSACTIVÉ ici : les tests modifient des
      // conversations puis regardent tout de suite le résultat. Sa version active est prouvée sur le serveur de production
      // (e2e-pwa/seller-trust-cache.spec.ts).
      RESPONSIVENESS_CACHE_TTL_MS: "0",
      // Lot 227 — même raison pour les agrégats du catalogue (1 h par défaut) : les tests publient une annonce puis lisent
      // les compteurs des pages marque/modèle/wilaya.
      CATALOGUE_STATS_CACHE_TTL_MS: "0",
    },
    },
  ],
});
