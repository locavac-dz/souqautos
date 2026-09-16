import { execSync } from "child_process";
import { existsSync, unlinkSync } from "fs";
import path from "path";

// Base SQLite jetable dédiée aux tests E2E (Lot 101) — jamais prisma/dev.db,
// qui porte les 24 annonces/9 utilisateurs de démonstration réels protégés
// tout au long du projet. Recréée depuis zéro avant chaque exécution
// complète de la suite : supprimée si elle existe, migrations appliquées
// (`migrate deploy`, jamais `migrate dev` — pas de shadow database en jeu,
// donc jamais le piège de checksum rencontré aux Lots 92/94/97), puis les
// deux scripts de seed déjà existants et vérifiés (`prisma/seed.ts`,
// `prisma/seed-demo-listings.ts`) pour repartir d'un état connu à chaque fois.
//
// Exécuté via le hook npm `pretest:e2e` (package.json), jamais via l'option
// `globalSetup` de Playwright : cette version de Playwright démarre son
// `webServer` (un plugin interne) AVANT d'exécuter globalSetup, donc le
// serveur Next se mettrait à interroger la base avant qu'elle existe — bug
// trouvé en écrivant ce lot (confirmé en lisant node_modules/playwright/lib/
// runner/index.js : createGlobalSetupTasks() liste createPluginSetupTasks()
// — qui inclut webServer — avant globalSetups()). Le hook `pretest` npm,
// lui, s'exécute et se termine avant que `playwright test` ne démarre quoi
// que ce soit.
const appRoot = path.resolve(__dirname, "..");
const dbPath = path.join(appRoot, "prisma", "e2e.db");
const journalPath = `${dbPath}-journal`;

for (const file of [dbPath, journalPath]) {
  if (existsSync(file)) unlinkSync(file);
}

const env = { ...process.env, DATABASE_URL: "file:./e2e.db" };
// Arguments tous statiques (aucune entrée utilisateur) — execSync avec une
// commande jointe évite l'avertissement de dépréciation DEP0190 d'un tableau
// d'arguments non échappé sous `shell: true`.
const run = (command: string) => execSync(command, { cwd: appRoot, env, stdio: "inherit" });

run("npx prisma migrate deploy");
run("npx tsx prisma/seed.ts");
run("npx tsx prisma/seed-demo-listings.ts");
