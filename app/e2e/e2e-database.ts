import path from "path";
import { loadEnvConfig } from "@next/env";

// Lot 109 — source UNIQUE de l'URL de la base des tests de bout en bout, lue
// par `e2e/reset-db.ts` (qui la vide) ET par `playwright.config.ts` (qui la
// passe au serveur de test) : aujourd'hui elles ne peuvent plus diverger.
//
// Garde-fou : `reset-db.ts` détruit tout le contenu de cette base. Elle est
// donc REFUSÉE si son nom ne se termine pas par « _e2e », ou si elle est
// identique à `DATABASE_URL` (la base de développement) — un simple nom de
// base différent ne doit jamais être la seule chose qui protège les données
// de démonstration.
const appRoot = path.resolve(__dirname, "..");
loadEnvConfig(appRoot);

export function getE2eDatabaseUrl(): string {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) {
    throw new Error(
      'E2E_DATABASE_URL manquante. Ajoutez-la à .env, ex. : E2E_DATABASE_URL="postgresql://souq_auto:motdepasse@localhost:5432/souq_auto_e2e"'
    );
  }

  const databaseName = new URL(url).pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_e2e")) {
    throw new Error(
      `Refus : la base de test « ${databaseName} » ne se termine pas par « _e2e ». Ce script vide entièrement la base ciblée.`
    );
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error("Refus : E2E_DATABASE_URL est identique à DATABASE_URL (base de développement).");
  }

  return url;
}
