import path from "path";
import { loadEnvConfig } from "@next/env";

// Lot 137 — source UNIQUE de l'adresse de la base de TEST DE CHARGE, lue par prisma/seed-load.ts (qui la remplit) et par
// scripts/load-test.mjs (qui y branche le serveur). Même principe que e2e/e2e-database.ts.
//
// Base dédiée, jamais la base de développement (données de démonstration) ni celle des tests de bout en bout : elle porte
// des dizaines de milliers d'annonces FABRIQUÉES, et `--reset` la vide entièrement. Refusée si son nom ne finit pas par
// « _load », ou si elle est identique à une autre base du projet.
//   LOAD_DATABASE_URL, sinon DATABASE_URL avec « _load » ajouté au nom de la base (souq_auto → souq_auto_load).
const appRoot = path.resolve(__dirname, "..");
loadEnvConfig(appRoot);

export function getLoadDatabaseUrl(): string {
  let url = process.env.LOAD_DATABASE_URL;
  if (!url) {
    const dev = process.env.DATABASE_URL;
    if (!dev) throw new Error("DATABASE_URL absente : impossible de déduire la base de test de charge. Définir LOAD_DATABASE_URL dans .env.");
    const derived = new URL(dev);
    derived.pathname = `${derived.pathname.replace(/_load$/, "")}_load`;
    url = derived.toString();
  }
  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  if (!name.endsWith("_load")) {
    throw new Error(`Refus : la base de charge « ${name} » ne se termine pas par « _load ». Ce script peut la vider entièrement.`);
  }
  if (url === process.env.DATABASE_URL || url === process.env.E2E_DATABASE_URL) {
    throw new Error("Refus : la base de charge est identique à la base de développement ou à celle des tests de bout en bout.");
  }
  return url;
}

export function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}
