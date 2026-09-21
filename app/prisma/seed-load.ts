import { execSync } from "child_process";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { createListingGenerator, mulberry32, type Catalogue } from "../scripts/load-data";
import { databaseName, getLoadDatabaseUrl } from "../scripts/load-database";

// Lot 137 — remplit la base de TEST DE CHARGE avec un volume réaliste d'annonces fabriquées :
//   npm run load:seed [-- --listings 20000 --sellers 600 --reset]
//
// Crée la base « <base>_load » si elle n'existe pas, y applique les migrations et les données de référence (wilayas, communes,
// catalogue), puis complète jusqu'au nombre d'annonces demandé (relancer avec le même nombre ne fait rien : idempotent).
// `--reset` la vide d'abord. Jamais la base de développement ni celle des tests : garde-fous dans scripts/load-database.ts.
// Les comptes vendeurs sont fictifs (charge-N@example.dz) avec un mot de passe inutilisable : personne ne peut s'y connecter.

const appRoot = path.resolve(__dirname, "..");
const BATCH = 2000;

function argNumber(name: string, fallback: number): number {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? Number(process.argv[index + 1]) : fallback;
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} attend un nombre entier positif.`);
  return value;
}

async function ensureDatabase(loadUrl: string) {
  const name = databaseName(loadUrl);
  const admin = new PrismaClient(); // la base de développement, seulement pour créer l'autre
  try {
    const exists = await admin.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM pg_database WHERE datname = ${name}`;
    if (Number(exists[0].n) === 0) {
      // Le nom vient de getLoadDatabaseUrl(), validé (se termine par _load) ; un identifiant ne peut pas être un paramètre SQL.
      if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`Nom de base inattendu : ${name}`);
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
      console.log(`Base « ${name} » créée.`);
    }
  } finally {
    await admin.$disconnect();
  }
}

// Lot 143 — des conversations réalistes, pour que le test de charge exerce aussi la mesure de réactivité des vendeurs (badge sur les
// cartes de résultats). Sans elles, la base de charge n'avait AUCUNE conversation et cette mesure paraissait gratuite.
// Déterministe et idempotent : ne fait rien si des conversations de charge existent déjà.
//  - ~12 % des annonces reçoivent une conversation ; comme les vendeurs sont tirés selon une loi de Zipf, quelques gros vendeurs en
//    ont des centaines (au-delà du plafond de 200 de la mesure), la plupart quelques-unes ;
//  - chaque vendeur a un profil fixe : réactif (45 %), moyen (30 %) ou quasi muet (25 %) ;
//  - dates réparties sur 90 jours, dont quelques-unes dans les 48 dernières heures (trop récentes pour être jugées).
async function seedConversations(prisma: PrismaClient, sellerIds: string[]) {
  if ((await prisma.conversation.count({ where: { id: { startsWith: "charge-conv-" } } })) > 0) {
    console.log("Des conversations de charge existent déjà : rien à ajouter.");
    return;
  }
  const listings = await prisma.listing.findMany({ where: { id: { startsWith: "charge-" } }, select: { id: true, sellerId: true }, orderBy: { id: "asc" } });
  const rand = mulberry32(143);
  const now = Date.now();
  const DAY = 86_400_000;
  const profileOf = (sellerId: string) => {
    let hash = 0;
    for (const ch of sellerId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const bucket = (hash % 100) / 100;
    return bucket < 0.45 ? { replyProbability: 0.95, medianMinutes: 20 } : bucket < 0.75 ? { replyProbability: 0.8, medianMinutes: 300 } : { replyProbability: 0.3, medianMinutes: 2880 };
  };

  const conversations: { id: string; listingId: string; buyerId: string; sellerId: string; createdAt: Date }[] = [];
  const messages: { conversationId: string; senderId: string; content: string; createdAt: Date }[] = [];
  for (const [index, listing] of listings.entries()) {
    if (rand() > 0.12) continue;
    let buyerId = sellerIds[Math.floor(rand() * sellerIds.length)];
    if (buyerId === listing.sellerId) buyerId = sellerIds[(sellerIds.indexOf(buyerId) + 1) % sellerIds.length];
    const asked = new Date(now - (rand() < 0.04 ? rand() * 2 * DAY : rand() * 89 * DAY));
    const id = `charge-conv-${index}`;
    conversations.push({ id, listingId: listing.id, buyerId, sellerId: listing.sellerId, createdAt: asked });
    messages.push({ conversationId: id, senderId: buyerId, content: "Bonjour, l'annonce est-elle toujours disponible ?", createdAt: asked });
    const profile = profileOf(listing.sellerId);
    if (rand() < profile.replyProbability) {
      // Délai log-normal autour de la médiane du profil : quelques réponses très lentes, beaucoup de rapides.
      const delay = profile.medianMinutes * Math.exp((rand() + rand() + rand() - 1.5) * 1.2);
      messages.push({ conversationId: id, senderId: listing.sellerId, content: "Oui, toujours disponible.", createdAt: new Date(Math.min(now, asked.getTime() + delay * 60_000)) });
    }
  }
  const CHUNK = 2000;
  for (let i = 0; i < conversations.length; i += CHUNK) await prisma.conversation.createMany({ data: conversations.slice(i, i + CHUNK), skipDuplicates: true });
  for (let i = 0; i < messages.length; i += CHUNK) await prisma.message.createMany({ data: messages.slice(i, i + CHUNK) });
  console.log(`Conversations de charge : ${conversations.length} conversations, ${messages.length} messages.`);
}

async function main() {
  const loadUrl = getLoadDatabaseUrl();
  const target = argNumber("--listings", 20_000);
  const sellersWanted = argNumber("--sellers", 600);
  const reset = process.argv.includes("--reset");
  const env = { ...process.env, DATABASE_URL: loadUrl };
  const run = (command: string) => execSync(command, { cwd: appRoot, env, stdio: "inherit" });

  await ensureDatabase(loadUrl);
  const prisma = new PrismaClient({ datasourceUrl: loadUrl });
  try {
    if (reset) {
      await prisma.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
      await prisma.$executeRawUnsafe("CREATE SCHEMA public");
    }
    const migrated = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prisma_migrations'`;
    if (Number(migrated[0].n) === 0) {
      run("npx prisma migrate deploy");
      run("npx tsx prisma/seed.ts");
    } else {
      run("npx prisma migrate deploy"); // rattrape une migration ajoutée depuis la dernière fois
    }

    const catalogueModels = await prisma.model.findMany({ select: { id: true, brandId: true, name: true, categories: true, brand: { select: { name: true } } } });
    const communes = await prisma.commune.findMany({ select: { id: true, wilayaId: true } });
    const communesByWilaya = new Map<number, number[]>();
    for (const c of communes) communesByWilaya.set(c.wilayaId, [...(communesByWilaya.get(c.wilayaId) ?? []), c.id]);
    const catalogue: Catalogue = {
      models: catalogueModels.map((m) => ({ id: m.id, brandId: m.brandId, name: m.name, brandName: m.brand.name, categories: m.categories })),
      wilayaIds: (await prisma.wilaya.findMany({ select: { id: true } })).map((w) => w.id),
      communesByWilaya,
      equipmentIds: (await prisma.equipment.findMany({ select: { id: true } })).map((e) => e.id),
    };

    // Vendeurs fictifs (complétés jusqu'au nombre demandé).
    const existingSellers = await prisma.user.count({ where: { email: { startsWith: "charge-" } } });
    if (existingSellers < sellersWanted) {
      const users = Array.from({ length: sellersWanted - existingSellers }, (_, i) => existingSellers + i + 1);
      await prisma.user.createMany({
        data: users.map((n) => ({ id: `charge-vendeur-${n}`, email: `charge-${n}@example.dz`, passwordHash: null, emailVerifiedAt: new Date() })),
        skipDuplicates: true,
      });
      await prisma.profile.createMany({ data: users.map((n) => ({ userId: `charge-vendeur-${n}`, displayName: `Vendeur de charge ${n}` })), skipDuplicates: true });
    }
    const sellerIds = (await prisma.user.findMany({ where: { email: { startsWith: "charge-" } }, select: { id: true }, orderBy: { id: "asc" } })).map((u) => u.id);

    const existing = await prisma.listing.count({ where: { id: { startsWith: "charge-" } } });
    const missing = target - existing;
    if (missing <= 0) {
      console.log(`La base contient déjà ${existing} annonces de charge (≥ ${target}) : aucune annonce à ajouter.`);
    } else {
      console.log(`Génération de ${missing} annonces (${existing} déjà présentes)…`);
    }
    const generate = createListingGenerator({ catalogue, sellerIds, now: Date.now(), seed: 137 + existing });
    const started = Date.now();
    for (let done = 0; missing > 0 && done < missing; done += BATCH) {
      const size = Math.min(BATCH, missing - done);
      const generated = Array.from({ length: size }, (_, i) => generate(existing + done + i));
      await prisma.listing.createMany({
        // Les colonnes non fournies prennent leurs valeurs par défaut (contentHash vide, etc.).
        data: generated.map((g) => g.listing) as never,
      });
      await prisma.listingPhoto.createMany({
        data: generated.flatMap((g) =>
          Array.from({ length: g.photoCount }, (_, position) => ({ listingId: g.listing.id, path: `/uploads/listings/charge-${(position % 3) + 1}.jpg`, position })),
        ),
      });
      await prisma.listingEquipment.createMany({
        data: generated.flatMap((g) => g.equipmentIds.map((equipmentId) => ({ listingId: g.listing.id, equipmentId }))),
        skipDuplicates: true,
      });
      process.stdout.write(`\r  ${Math.min(done + size, missing)} / ${missing}`);
    }
    if (missing > 0) console.log(`\nTerminé en ${((Date.now() - started) / 1000).toFixed(1)} s.`);
    await seedConversations(prisma, sellerIds);
    const rows = await prisma.$queryRaw<{ status: string; n: bigint }[]>`SELECT status::text AS status, count(*) AS n FROM "Listing" GROUP BY status ORDER BY n DESC`;
    console.log("Annonces par statut :", rows.map((r) => `${r.status}=${r.n}`).join(", "));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
