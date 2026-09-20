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
    // Lot 134 : next-intl (ESM) importe « next/server » sans extension, ce que Node refuse hors du traitement de Vite ;
    // le test du proxy (tests/proxy.test.ts) a besoin du vrai next-intl, pas d'une copie simulée.
    server: { deps: { inline: ["next-intl"] } },
  },
});
