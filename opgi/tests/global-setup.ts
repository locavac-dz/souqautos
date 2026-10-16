// Préparation de la base de test (vitest globalSetup) :
//   1. applique les migrations (rôle propriétaire) sur TEST_DIRECT_DATABASE_URL ;
//   2. accorde les droits CRUD au rôle applicatif `opgi_app` (idempotent) ;
//   3. vide puis réensemence deux organismes fictifs.
//
// Prérequis CI (documenté dans README) : le rôle `opgi_app` existe dans le
// cluster (créé une fois via prisma/provision-roles.sql par un superutilisateur).
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { loadEnv, requireEnv } from "./_env.js";
import { hashPassword } from "../src/lib/auth/password.js";

/** Mot de passe des comptes de DÉMONSTRATION (jamais en production). */
export const DEMO_PASSWORD = "Demo-1234!";

export default async function setup() {
  loadEnv();
  const directUrl = requireEnv("TEST_DIRECT_DATABASE_URL");

  // 1. Migrations avec le rôle propriétaire.
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DIRECT_DATABASE_URL: directUrl, DATABASE_URL: directUrl },
  });

  const owner = new PrismaClient({ datasources: { db: { url: directUrl } } });
  try {
    // 2. Droits pour le rôle applicatif (le propriétaire peut accorder sur ses tables).
    await owner.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO opgi_app`,
    );

    // 3. Réensemencement déterministe (données fictives).
    await owner.bien.deleteMany();
    await owner.utilisateur.deleteMany();
    await owner.organisation.deleteMany();

    const pwd = await hashPassword(DEMO_PASSWORD);
    await owner.organisation.create({
      data: {
        code: "OPGI-ALGER",
        nom: "OPGI Alger (DÉMO)",
        modules: ["A", "B", "C"],
        biens: { create: [{ code: "ALG-LOG-0001", type: "LOGEMENT", etatOccupation: "OCCUPE" }] },
        utilisateurs: {
          create: [
            { email: "agent@opgi-alger.demo", role: "AGENT_LOCATIF", passwordHash: pwd },
            { email: "chef@opgi-alger.demo", role: "CHEF_PROJET", passwordHash: pwd },
          ],
        },
      },
    });
    await owner.organisation.create({
      data: {
        code: "OPGI-ORAN",
        nom: "OPGI Oran (DÉMO)",
        modules: ["A", "C"],
        biens: { create: [{ code: "ORN-LOG-0001", type: "LOGEMENT", etatOccupation: "OCCUPE" }] },
        utilisateurs: {
          create: [{ email: "agent@opgi-oran.demo", role: "AGENT_LOCATIF", passwordHash: pwd }],
        },
      },
    });
  } finally {
    await owner.$disconnect();
  }
}
