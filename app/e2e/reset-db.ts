import { execSync } from "child_process";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { getE2eDatabaseUrl } from "./e2e-database";

// Base PostgreSQL jetable dédiée aux tests E2E (Lot 101, passée de SQLite à
// PostgreSQL au Lot 109) — jamais la base de développement, qui porte les
// données de démonstration. Recréée depuis zéro avant chaque exécution
// complète de la suite : le schéma `public` est supprimé puis recréé (ce qui
// remet aussi les séquences à zéro — `prisma/generation-data.ts` référence des
// `modelId` qui supposent des ids de modèles 1..N), les migrations sont
// réappliquées (`migrate deploy`, jamais `migrate dev` : pas de shadow
// database en jeu), puis les deux scripts de seed déjà existants
// (`prisma/seed.ts`, `prisma/seed-demo-listings.ts`).
//
// Le schéma est vidé par SQL plutôt que par `prisma migrate reset` : ce
// dernier est verrouillé par Prisma quand il est lancé par un agent IA, et
// exige un consentement explicite de l'utilisateur. Ici la cible est
// restreinte par `getE2eDatabaseUrl()` à une base dont le nom finit par
// « _e2e ».
//
// Exécuté via le hook npm `pretest:e2e` (package.json), jamais via l'option
// `globalSetup` de Playwright : cette version de Playwright démarre son
// `webServer` AVANT d'exécuter globalSetup, donc le serveur Next se mettrait à
// interroger la base avant qu'elle soit prête (confirmé en lisant
// node_modules/playwright/lib/runner/index.js). Le hook `pretest` npm, lui,
// se termine avant que `playwright test` ne démarre quoi que ce soit.
const appRoot = path.resolve(__dirname, "..");
const databaseUrl = getE2eDatabaseUrl();

async function dropAndRecreateSchema() {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    await prisma.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
    await prisma.$executeRawUnsafe("CREATE SCHEMA public");
  } finally {
    await prisma.$disconnect();
  }
}

const env = { ...process.env, DATABASE_URL: databaseUrl };
// Arguments tous statiques (aucune entrée utilisateur) — execSync avec une
// commande jointe évite l'avertissement de dépréciation DEP0190 d'un tableau
// d'arguments non échappé sous `shell: true`.
const run = (command: string) => execSync(command, { cwd: appRoot, env, stdio: "inherit" });

async function main() {
  await dropAndRecreateSchema();
  run("npx prisma migrate deploy");
  run("npx tsx prisma/seed.ts");
  run("npx tsx prisma/seed-demo-listings.ts");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
