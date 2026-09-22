// Lot 166 — Seed historique de prix pour la démo du graphique MonthlyPriceBars.
//
// Le graphique sur /voitures/[brand]/[model] ne s'affiche que si au moins 3 mois
// distincts ont chacun ≥ 2 annonces PUBLIEE. La base de démo créée par
// seed-demo-listings.ts ne contient qu'une annonce par modèle, toutes récentes
// (≤ 20 jours).
//
// Ce script ajoute, pour Renault Clio et Toyota Corolla :
//   - 3 annonces fictives par mois sur les 12 derniers mois
//   - Prix légèrement variables pour simuler une évolution réaliste
//   - Vendeurs : comptes démo existants (ne recréés pas)
//
// Utilisation : npx tsx prisma/seed-price-history.ts
//   (nécessite `npm run seed` puis `npx tsx prisma/seed-demo-listings.ts` d'abord)

import { PrismaClient, type FuelType, type Gearbox } from "@prisma/client";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { computeExpiryDate } from "../src/lib/listing-lifecycle";
import { formulaValidityDays } from "../src/lib/payment-orders";
import { storeProcessedImage } from "../src/lib/uploads";
import { slugify } from "./catalogue-data";

const prisma = new PrismaClient();

const BRAND_COLORS: Record<string, string> = {
  Renault: "#1B3A6B",
  Toyota: "#7F1D1D",
};

// Marqueur dans la description pour ne pas dupliquer si le script est relancé.
const HISTORY_MARKER = "[price-history-seed]";

async function generatePlaceholderPhoto(brand: string, model: string): Promise<string> {
  const color = BRAND_COLORS[brand] ?? "#334155";
  const label = model.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const brandLabel = brand.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg width="1200" height="900" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${color}"/>
    <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="72" fill="#ffffff" text-anchor="middle" font-weight="bold">${brandLabel}</text>
    <text x="50%" y="58%" font-family="Arial, sans-serif" font-size="44" fill="#e2e8f0" text-anchor="middle">${label}</text>
  </svg>`;
  const output = await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
  return storeProcessedImage("listings", `${randomUUID()}.jpg`, output);
}

// Prix de base par modèle (DA) avec variation mensuelle simulée.
const MODELS: {
  brand: string;
  model: string;
  basePrice: number;
  priceStep: number;
  fuelType: FuelType;
  gearbox: Gearbox;
  baseYear: number;
  mileagePerMonth: number;
}[] = [
  {
    brand: "Renault",
    model: "Clio",
    basePrice: 2_100_000,
    priceStep: 25_000,     // +25 000 DA par mois (marché en hausse légère)
    fuelType: "DIESEL",
    gearbox: "MANUELLE",
    baseYear: 2018,
    mileagePerMonth: 1_500,
  },
  {
    brand: "Toyota",
    model: "Corolla",
    basePrice: 3_700_000,
    priceStep: 40_000,
    fuelType: "ESSENCE",
    gearbox: "AUTOMATIQUE",
    baseYear: 2020,
    mileagePerMonth: 1_200,
  },
];

// 3 vendeurs "demo" existants qu'on réutilise.
const SELLER_EMAILS = [
  "karim.boudiaf@example.dz",
  "yasmine.cherif@example.dz",
  "riad.benaissa@example.dz",
];

async function main() {
  // Vérification préalable.
  const brandCount = await prisma.brand.count();
  if (brandCount === 0) {
    throw new Error("Catalogue vide — lancez d'abord `npm run seed`.");
  }

  // Résolution des vendeurs.
  const sellers = await prisma.user.findMany({
    where: { email: { in: SELLER_EMAILS } },
    select: { id: true, email: true, profile: { select: { wilayaId: true } } },
  });
  if (sellers.length === 0) {
    throw new Error("Aucun vendeur démo trouvé — lancez d'abord seed-demo-listings.ts.");
  }

  // Suppression des entrées précédentes de ce seed pour idempotence.
  const deleted = await prisma.listing.deleteMany({
    where: { description: { contains: HISTORY_MARKER } },
  });
  if (deleted.count > 0) console.log(`Ancien historique supprimé : ${deleted.count} annonces`);

  let created = 0;

  for (const spec of MODELS) {
    const brandRow = await prisma.brand.findUnique({ where: { slug: slugify(spec.brand) } });
    const modelRow = brandRow
      ? await prisma.model.findUnique({
          where: { brandId_slug: { brandId: brandRow.id, slug: slugify(spec.model) } },
        })
      : null;
    if (!brandRow || !modelRow) {
      console.warn(`Modèle introuvable : ${spec.brand} ${spec.model} — ignoré`);
      continue;
    }

    // Photo placeholder réutilisée pour toutes les annonces du modèle.
    const photoPath = await generatePlaceholderPhoto(spec.brand, spec.model);

    // 12 mois (m = 0 = mois courant, m = 11 = il y a 11 mois).
    for (let m = 11; m >= 0; m--) {
      // Prix croissant légèrement vers le présent (simulation marché en hausse).
      const monthPrice = spec.basePrice + spec.priceStep * (11 - m);

      // 3 annonces par mois, réparties sur des jours différents.
      const DAY_OFFSETS = [5, 14, 22];
      for (let i = 0; i < 3; i++) {
        const daysAgo = m * 30 + DAY_OFFSETS[i];
        const publishedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

        // Petite variation de ±5 % autour du prix du mois.
        const variation = (Math.random() * 0.1 - 0.05);
        const price = Math.round((monthPrice * (1 + variation)) / 50_000) * 50_000;

        const seller = sellers[i % sellers.length];
        const wilayaId = seller.profile?.wilayaId ?? 16;
        const mileage = Math.round(spec.baseYear < 2020
          ? 80_000 + m * spec.mileagePerMonth + i * 5_000
          : 30_000 + m * spec.mileagePerMonth + i * 3_000);

        const listing = await prisma.listing.create({
          data: {
            sellerId: seller.id,
            category: "VOITURE",
            brandId: brandRow.id,
            modelId: modelRow.id,
            title: `${spec.brand} ${spec.model} ${spec.baseYear}`,
            description: `${spec.brand} ${spec.model}, bon état général, entretien suivi. ${HISTORY_MARKER}`,
            price,
            year: spec.baseYear,
            mileage,
            fuelType: spec.fuelType,
            gearbox: spec.gearbox,
            condition: "OCCASION",
            wilayaId,
            formula: "STANDARD",
            status: "PUBLIEE",
            createdAt: publishedAt,
            publishedAt,
            expiresAt: computeExpiryDate(publishedAt, formulaValidityDays("STANDARD")),
          },
        });

        await prisma.listingPhoto.create({
          data: { listingId: listing.id, position: 0, path: photoPath },
        });

        created++;
      }
    }

    console.log(`${spec.brand} ${spec.model} : 36 annonces créées sur 12 mois`);
  }

  console.log(`\nTotal créé : ${created} annonces`);
  console.log("Le graphique d'évolution des prix est maintenant visible sur :");
  console.log("  /voitures/renault/clio");
  console.log("  /voitures/toyota/corolla");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
