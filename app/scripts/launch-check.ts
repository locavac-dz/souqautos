// Lot 117 — `npm run launch:check [-- --env chemin/du/fichier.env]`
//
// Contrôle de préparation à la mise en ligne : lit la configuration (le fichier
// .env par défaut) et interroge la base, puis affiche ce qui bloque le
// lancement (✗), ce qui mérite attention (⚠) et ce qui est en ordre (✓).
// Code de sortie 1 s'il reste au moins une erreur. Ne modifie RIEN.

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD } from "../src/lib/admin-bootstrap";
import { evaluateLaunchReadiness, summarizeChecks, type LaunchFacts } from "../src/lib/launch-checks";

const DEMO_DOMAINS = ["@example.dz", "@example.com", "@example.org"];

// Lot 233 — sans --env, un .env absent n'est pas une erreur : dans un conteneur, la configuration est dans les variables
// d'environnement (docker compose run --rm tools npm run launch:check). Rend ce qui a été lu, pour l'afficher.
function loadEnvFile(): string {
  const flag = process.argv.indexOf("--env");
  const explicit = flag >= 0;
  const file = explicit ? process.argv[flag + 1] : ".env";
  if (!file) {
    console.error("--env attend un chemin de fichier.");
    process.exit(2);
  }
  const resolved = path.resolve(process.cwd(), file);
  if (!existsSync(resolved)) {
    if (!explicit) return "les variables d'environnement (aucun fichier .env)";
    console.error(`Fichier de configuration introuvable : ${resolved}`);
    process.exit(2);
  }
  process.loadEnvFile(resolved);
  return resolved;
}

async function collectFacts(): Promise<LaunchFacts> {
  const migrationsDir = path.resolve(process.cwd(), "prisma/migrations");
  const migrationsOnDisk = readdirSync(migrationsDir).filter((name) => statSync(path.join(migrationsDir, name)).isDirectory()).length;

  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    await prisma.$disconnect();
    return { dbReachable: false, adminUsesDevPassword: false, demoAccounts: 0, migrationsOnDisk, migrationsApplied: 0 };
  }

  try {
    const applied = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    const admin = await prisma.user.findUnique({ where: { email: DEV_ADMIN_EMAIL }, select: { passwordHash: true } });
    // Lot 138 — cette colonne vient d'une migration : tant qu'elle n'est pas appliquée, la requête échoue. Ce n'est pas une raison de
    // planter (le contrôle « migrations » le dit déjà, en clair) : le chiffre reste simplement inconnu.
    const staffWithoutTwoFactor = await prisma.user
      .count({ where: { role: { in: ["ADMIN", "MODERATEUR"] }, totpEnabledAt: null, deletedAt: null, suspendedAt: null } })
      .catch(() => undefined);
    const demoAccounts = await prisma.user.count({ where: { OR: DEMO_DOMAINS.map((domain) => ({ email: { endsWith: domain, mode: "insensitive" as const } })) } });
    return {
      dbReachable: true,
      adminUsesDevPassword: admin?.passwordHash ? await bcrypt.compare(DEV_ADMIN_PASSWORD, admin.passwordHash) : false,
      demoAccounts,
      staffWithoutTwoFactor,
      migrationsOnDisk,
      migrationsApplied: Number(applied[0]?.count ?? 0),
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const envFile = loadEnvFile();
  console.log(`Contrôle de mise en ligne — configuration lue dans ${envFile}\n(évaluée comme pour la PRODUCTION, quel que soit l'environnement actuel)\n`);

  const results = evaluateLaunchReadiness({ env: process.env, facts: await collectFacts() });
  const icon = { ok: "✓", warning: "⚠", error: "✗" } as const;
  for (const level of ["error", "warning", "ok"] as const) {
    for (const r of results.filter((x) => x.level === level)) {
      console.log(`${icon[level]} ${r.message}`);
      if (r.fix && level !== "ok") console.log(`    → ${r.fix}`);
    }
  }

  const { errors, warnings, ok, ready } = summarizeChecks(results);
  console.log(`\n${ok} en ordre, ${warnings} point(s) d'attention, ${errors} bloquant(s).`);
  console.log(ready ? "Prêt sous réserve des points d'attention." : "NON PRÊT : corriger les points bloquants (✗) avant la mise en ligne.");
  process.exit(ready ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
