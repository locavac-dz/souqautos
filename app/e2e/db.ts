import { PrismaClient, type ProSubscriptionTier } from "@prisma/client";
import { getE2eDatabaseUrl } from "./e2e-database";

// Lot 131 — accès direct à la base des tests de bout en bout, pour PRÉPARER un état que l'interface ne permet pas
// d'atteindre seule (promouvoir un compte jetable en administrateur, publier une annonce sans passer par la
// modération, poser un abonnement) ou pour LIRE ce que le site a réellement écrit (compteurs d'audience).
//
// Jamais la base de développement : `getE2eDatabaseUrl()` refuse toute base dont le nom ne finit pas par « _e2e ».
// Client SANS l'extension de chiffrement du site : le téléphone d'un compte y reste chiffré, et ne doit être ni lu
// ni écrit ici (les tests passent par l'API pour cela).
let client: PrismaClient | null = null;

export function e2eDb(): PrismaClient {
  client ??= new PrismaClient({ datasourceUrl: getE2eDatabaseUrl() });
  return client;
}

export async function disconnectE2eDb(): Promise<void> {
  await client?.$disconnect();
  client = null;
}

export async function makeAdmin(email: string): Promise<void> {
  await e2eDb().user.update({ where: { email }, data: { role: "ADMIN" } });
}

// Équivalent d'une approbation par la modération : l'annonce devient visible.
export async function publishListing(id: string): Promise<void> {
  const now = new Date();
  await e2eDb().listing.update({
    where: { id },
    data: { status: "PUBLIEE", publishedAt: now, expiresAt: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000) },
  });
}

export async function setProSubscription(userId: string, tier: ProSubscriptionTier): Promise<void> {
  const account = await e2eDb().professionalAccount.findUniqueOrThrow({ where: { userId } });
  const expiresAt = tier === "STARTER" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await e2eDb().proSubscription.upsert({
    where: { professionalAccountId: account.id },
    update: { tier, expiresAt },
    create: { professionalAccountId: account.id, tier, expiresAt },
  });
}

export async function userIdOf(email: string): Promise<string> {
  return (await e2eDb().user.findUniqueOrThrow({ where: { email }, select: { id: true } })).id;
}

// Numéro algérien plausible et unique : le téléphone d'un compte est unique dans la base.
export function uniquePhone(): string {
  return "05" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
}
