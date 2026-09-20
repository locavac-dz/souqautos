// Lot 138 — `npm run auth:reset-2fa -- --email adresse@du-compte [--env chemin/fichier.env]`
//
// Réinitialise la double authentification d'UN compte : à utiliser quand l'unique administrateur a perdu son téléphone ET ses
// codes de secours (un autre administrateur peut le faire depuis « Utilisateurs » ; ici, il n'y en a pas). Exige l'accès au serveur
// et à sa configuration : une session ouverte ne suffit pas à se retirer sa propre protection.
//
// Effets : secret et codes de secours supprimés, toutes les sessions du compte révoquées, titulaire prévenu par courriel, action
// écrite dans le journal d'audit. Le compte redevient protégé par son seul mot de passe ; s'il est de l'équipe et que la double
// authentification est exigée, il n'aura que les droits d'un compte ordinaire jusqu'à ce qu'il la réactive (Sécurité du compte).

import { existsSync } from "node:fs";
import path from "node:path";

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const envFile = path.resolve(process.cwd(), argValue("--env") ?? ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  else if (argValue("--env")) {
    console.error(`Fichier de configuration introuvable : ${envFile}`);
    process.exit(2);
  }
  const email = argValue("--email")?.trim().toLowerCase();
  if (!email) {
    console.error("Usage : npm run auth:reset-2fa -- --email adresse@du-compte");
    process.exit(2);
  }

  // Importés ICI, après le chargement de la configuration : ces modules lisent la clé de chiffrement et la base au premier appel.
  const { prisma } = await import("../src/lib/prisma");
  const { resetTwoFactor } = await import("../src/lib/two-factor");
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (!user) {
      console.error(`Aucun compte avec l'adresse ${email}.`);
      process.exit(1);
    }
    const result = await resetTwoFactor(user.id, user.id);
    if (!result.ok) {
      console.error(result.error === "not_enabled" ? "La double authentification n'est pas activée sur ce compte : rien à faire." : "Compte introuvable.");
      process.exit(1);
    }
    console.log(`✓ Double authentification réinitialisée pour ${email} (${user.role}). Ses sessions sont révoquées ; il en sera prévenu par courriel.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`La réinitialisation a échoué : ${(error as Error).message}`);
  process.exit(1);
});
