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
    // Le journal d'audit reste APPEND-ONLY même après le GRANT ci-dessus.
    await owner.$executeRawUnsafe(`REVOKE UPDATE, DELETE ON "audit_log" FROM opgi_app`);

    // 3. Réensemencement déterministe (données fictives). Ordre de suppression
    //    respectant les clés étrangères.
    await owner.notification.deleteMany();
    await owner.auditLog.deleteMany();
    await owner.imputation.deleteMany();
    await owner.paiement.deleteMany();
    await owner.appelLoyer.deleteMany();
    await owner.actionRecouvrement.deleteMany();
    await owner.pieceJointe.deleteMany();
    await owner.commentaireReclamation.deleteMany();
    await owner.ordreTravail.deleteMany();
    await owner.reclamation.deleteMany();
    await owner.reception.deleteMany();
    await owner.situationTravaux.deleteMany();
    await owner.marche.deleteMany();
    await owner.projet.deleteMany();
    await owner.entreprise.deleteMany();
    await owner.contrat.deleteMany();
    await owner.bien.deleteMany();
    await owner.batiment.deleteMany();
    await owner.site.deleteMany();
    await owner.occupant.deleteMany();
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
            { email: "admin@opgi-alger.demo", role: "ADMIN_OPGI", passwordHash: pwd },
            { email: "chef@opgi-alger.demo", role: "CHEF_PROJET", passwordHash: pwd },
            { email: "auditeur@opgi-alger.demo", role: "AUDITEUR", passwordHash: pwd },
            { email: "resp@opgi-alger.demo", role: "RESP_RECLAMATIONS", passwordHash: pwd },
            { email: "tech@opgi-alger.demo", role: "TECHNICIEN", passwordHash: pwd },
            { email: "tech2@opgi-alger.demo", role: "TECHNICIEN", passwordHash: pwd },
            { email: "presta@opgi-alger.demo", role: "PRESTATAIRE", passwordHash: pwd },
            { email: "presta2@opgi-alger.demo", role: "PRESTATAIRE", passwordHash: pwd },
            { email: "occ@opgi-alger.demo", role: "OCCUPANT", passwordHash: pwd },
            { email: "occ2@opgi-alger.demo", role: "OCCUPANT", passwordHash: pwd },
            { email: "gest@opgi-alger.demo", role: "GESTIONNAIRE_MARCHES", passwordHash: pwd },
            { email: "recouv@opgi-alger.demo", role: "AGENT_RECOUVREMENT", passwordHash: pwd },
            // Compte dédié aux tests de verrouillage (jamais utilisé ailleurs).
            { email: "lockme@opgi-alger.demo", role: "AUDITEUR", passwordHash: pwd },
            // Compte dédié au test de changement de mot de passe (muté par ce test).
            { email: "mdp@opgi-alger.demo", role: "AUDITEUR", passwordHash: pwd },
            // Compte dédié au test 2FA/TOTP (muté par ce test).
            { email: "totp@opgi-alger.demo", role: "AUDITEUR", passwordHash: pwd },
            // Compte dédié au test de révocation de session (muté par ce test).
            { email: "revoke@opgi-alger.demo", role: "AUDITEUR", passwordHash: pwd },
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
          create: [
            { email: "agent@opgi-oran.demo", role: "AGENT_LOCATIF", passwordHash: pwd },
            { email: "gest@opgi-oran.demo", role: "GESTIONNAIRE_MARCHES", passwordHash: pwd },
            { email: "admin@opgi-oran.demo", role: "ADMIN_OPGI", passwordHash: pwd },
          ],
        },
      },
    });
  } finally {
    await owner.$disconnect();
  }
}
