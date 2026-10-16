import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Les tests d'isolation en base s'exécutent en série (une seule base de test
    // partagée) ; les tests purs sont indépendants. On force la sérialité pour
    // éviter les courses sur `app.org_id` entre fichiers.
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
  },
});
