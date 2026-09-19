import { defineConfig, defaultExclude } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    // e2e/ contient les specs Playwright (e2e/*.spec.ts) — une API de test
    // différente (@playwright/test), jamais exécutées par vitest (Lot 101).
    // Étend la liste par défaut de vitest plutôt que de la remplacer.
    // Lot 120 : e2e-pwa/ = specs Playwright de l'application installable (même raison).
    exclude: [...defaultExclude, "e2e/**", "e2e-pwa/**"],
  },
});
