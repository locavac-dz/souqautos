// ============================================================================
//  Données de DÉMONSTRATION — FICTIVES. Ne jamais utiliser en production.
//
//  Crée deux OPGI fictifs (OPGI-ALGER, OPGI-ORAN) avec quelques utilisateurs et
//  biens, pour démontrer l'isolation inter‑organisme. Aucune donnée réelle.
//
//  Le seed se connecte avec le rôle PROPRIÉTAIRE (`DIRECT_DATABASE_URL`), non
//  soumis à la RLS, afin de pouvoir insérer à travers plusieurs organismes.
// ============================================================================

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password.js";

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL requis pour le seed (rôle propriétaire).");

const prisma = new PrismaClient({ datasources: { db: { url } } });

// Mot de passe des comptes de DÉMONSTRATION (jamais en production).
const DEMO_PASSWORD = "Demo-1234!";

async function main() {
  const pwd = await hashPassword(DEMO_PASSWORD);

  // Idempotent : on repart propre sur les organismes de démonstration.
  await prisma.organisation.deleteMany({ where: { code: { in: ["OPGI-ALGER", "OPGI-ORAN"] } } });

  const alger = await prisma.organisation.create({
    data: {
      code: "OPGI-ALGER",
      nom: "OPGI Alger (DÉMONSTRATION — données fictives)",
      modules: ["A", "B", "C"],
      utilisateurs: {
        create: [
          { email: "admin@opgi-alger.demo", role: "ADMIN_OPGI", passwordHash: pwd },
          { email: "agent.locatif@opgi-alger.demo", role: "AGENT_LOCATIF", passwordHash: pwd },
        ],
      },
      biens: {
        create: [
          { code: "ALG-LOG-0001", type: "LOGEMENT", etatOccupation: "OCCUPE", adresse: "Cité des Annassers, Alger (fictif)" },
          { code: "ALG-LOC-0001", type: "LOCAL_COMMERCIAL", etatOccupation: "VACANT", adresse: "Rue Didouche Mourad (fictif)" },
        ],
      },
    },
  });

  const oran = await prisma.organisation.create({
    data: {
      code: "OPGI-ORAN",
      nom: "OPGI Oran (DÉMONSTRATION — données fictives)",
      modules: ["A", "C"],
      utilisateurs: {
        create: [
          { email: "admin@opgi-oran.demo", role: "ADMIN_OPGI", passwordHash: pwd },
          { email: "agent.locatif@opgi-oran.demo", role: "AGENT_LOCATIF", passwordHash: pwd },
        ],
      },
      biens: {
        create: [
          { code: "ORN-LOG-0001", type: "LOGEMENT", etatOccupation: "OCCUPE", adresse: "Haï El Yasmine, Oran (fictif)" },
        ],
      },
    },
  });

  console.log(`Seed terminé (données fictives) :`);
  console.log(`  - ${alger.nom} [${alger.code}]`);
  console.log(`  - ${oran.nom} [${oran.code}]`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
