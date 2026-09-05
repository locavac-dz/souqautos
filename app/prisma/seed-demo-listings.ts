// Lot 71 — Jeu de données de démonstration, à la demande explicite du porteur
// de projet (« générer un vrai jeu de données de démonstration »), après avoir
// constaté que les seules annonces existantes étaient des résidus de tests
// (8 annonces "Renault Clio 4 diesel" quasi identiques sur un seul compte).
//
// Script séparé du seed principal (prisma/seed.ts) : celui-ci gère les
// données de référence idempotentes (wilayas, marques/modèles, admin) ;
// celui-ci crée du contenu éditorial (comptes vendeurs + annonces) — à lancer
// une seule fois avec `npx tsx prisma/seed-demo-listings.ts` (nécessite que
// `npm run seed` ait déjà tourné pour peupler le catalogue marques/modèles).
//
// Photos : aucune vraie photo de véhicule utilisée (aucune source fiable/
// libre de droits disponible sur cette machine) — un visuel de substitution
// généré localement (fond coloré + nom marque/modèle) est utilisé à la place,
// honnêtement un placeholder, jamais présenté comme une vraie photo.

import { PrismaClient, type FuelType, type Gearbox, type ListingCondition, type ListingFormula } from "@prisma/client";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { computeExpiryDate } from "../src/lib/listing-lifecycle";
import { formulaValidityDays } from "../src/lib/payment-orders";
import { slugify } from "./catalogue-data";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "DemoVendeur2026!";

const LISTING_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "listings");

const BRAND_COLORS: Record<string, string> = {
  Renault: "#1B3A6B",
  Dacia: "#2B6E4F",
  Volkswagen: "#173A5E",
  Peugeot: "#1F2937",
  Hyundai: "#0F4C81",
  Toyota: "#7F1D1D",
  Kia: "#4C1D95",
  Fiat: "#B45309",
  Seat: "#B91C1C",
  Citroën: "#0E7490",
  Suzuki: "#1D4ED8",
  Skoda: "#065F46",
  Ford: "#1E3A8A",
  Nissan: "#374151",
  Opel: "#78350F",
  "Mercedes-Benz": "#111827",
  BMW: "#1E3A8A",
  Audi: "#27272A",
  Chery: "#7C2D12",
};

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function generatePlaceholderPhoto(brand: string, model: string): Promise<string> {
  const color = BRAND_COLORS[brand] ?? "#334155";
  const svg = `<svg width="1200" height="900" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${color}"/>
    <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="72" fill="#ffffff" text-anchor="middle" font-weight="bold">${escapeXml(brand)}</text>
    <text x="50%" y="58%" font-family="Arial, sans-serif" font-size="44" fill="#e2e8f0" text-anchor="middle">${escapeXml(model)}</text>
  </svg>`;

  await mkdir(LISTING_UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.jpg`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toFile(path.join(LISTING_UPLOAD_DIR, filename));
  return `/uploads/listings/${filename}`;
}

type DemoSeller = {
  key: string;
  email: string;
  displayName: string;
  wilayaId: number;
};

// Comptes individuels dédiés à ce jeu de démonstration (distincts des
// personas de test amine.benali/sara.hamdi utilisés ailleurs pour vérifier
// les permissions) — sauf "sara" qui réutilise le compte professionnel
// existant "Auto Sara Motors" pour peupler aussi la vitrine pro.
const DEMO_SELLERS: DemoSeller[] = [
  { key: "karim", email: "karim.boudiaf@example.dz", displayName: "Karim Boudiaf", wilayaId: 31 },
  { key: "yasmine", email: "yasmine.cherif@example.dz", displayName: "Yasmine Cherif", wilayaId: 16 },
  { key: "riad", email: "riad.benaissa@example.dz", displayName: "Riad Benaissa", wilayaId: 25 },
  { key: "amel", email: "amel.ferhat@example.dz", displayName: "Amel Ferhat", wilayaId: 9 },
  { key: "sofiane", email: "sofiane.guerroudj@example.dz", displayName: "Sofiane Guerroudj", wilayaId: 19 },
  { key: "nadia", email: "nadia.bouzid@example.dz", displayName: "Nadia Bouzid", wilayaId: 23 },
];

type DemoListing = {
  sellerKey: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  price: number;
  fuelType: FuelType;
  gearbox: Gearbox;
  condition: ListingCondition;
  formula: ListingFormula;
  description: string;
  daysAgo: number;
};

const LISTINGS: DemoListing[] = [
  // Karim Boudiaf — Oran
  { sellerKey: "karim", brand: "Renault", model: "Clio", year: 2018, mileage: 92000, price: 2200000, fuelType: "DIESEL", gearbox: "MANUELLE", condition: "OCCASION", formula: "STANDARD", daysAgo: 3,
    description: "Renault Clio en bon état général, entretien suivi chez le concessionnaire. Climatisation fonctionnelle, pneus récents. Visible à Oran, dossier de vente disponible sur demande." },
  { sellerKey: "karim", brand: "Dacia", model: "Duster", year: 2020, mileage: 65000, price: 3400000, fuelType: "DIESEL", gearbox: "MANUELLE", condition: "OCCASION", formula: "PREMIUM", daysAgo: 8,
    description: "Dacia Duster 4x2, première main, jamais accidentée. Carnet d'entretien à jour, climatisation, régulateur de vitesse. Idéale pour la famille comme pour les longs trajets." },
  { sellerKey: "karim", brand: "Volkswagen", model: "Golf", year: 2016, mileage: 140000, price: 2900000, fuelType: "DIESEL", gearbox: "MANUELLE", condition: "OCCASION", formula: "STANDARD", daysAgo: 15,
    description: "Volkswagen Golf diesel, kilométrage autoroutier. Intérieur propre, vitres électriques, climatisation. Quelques traces d'usage normal, mécanique saine." },

  // Yasmine Cherif — Alger
  { sellerKey: "yasmine", brand: "Peugeot", model: "208", year: 2019, mileage: 48000, price: 2700000, fuelType: "ESSENCE", gearbox: "MANUELLE", condition: "OCCASION", formula: "STANDARD", daysAgo: 1,
    description: "Peugeot 208 essence, faible kilométrage pour l'année. Très propre intérieur comme extérieur, aucun accident. Idéale première voiture ou usage urbain." },
  { sellerKey: "yasmine", brand: "Hyundai", model: "Tucson", year: 2021, mileage: 32000, price: 5800000, fuelType: "DIESEL", gearbox: "AUTOMATIQUE", condition: "OCCASION", formula: "PREMIUM_PLUS", daysAgo: 5,
    description: "Hyundai Tucson récent, boîte automatique, très faible kilométrage. Toutes options : caméra de recul, sièges chauffants, régulateur adaptatif. Garantie constructeur encore active." },
  { sellerKey: "yasmine", brand: "Toyota", model: "Yaris", year: 2017, mileage: 88000, price: 2100000, fuelType: "ESSENCE", gearbox: "MANUELLE", condition: "OCCASION", formula: "STANDARD", daysAgo: 12,
    description: "Toyota Yaris fiable et économique, entretien régulier. Climatisation, vitres électriques avant. Parfaite pour la circulation en ville." },

  // Riad Benaissa — Constantine
  { sellerKey: "riad", brand: "Kia", model: "Sportage", year: 2019, mileage: 71000, price: 4600000, fuelType: "DIESEL", gearbox: "AUTOMATIQUE", condition: "OCCASION", formula: "STANDARD", daysAgo: 4,
    description: "Kia Sportage diesel, boîte automatique, très bon état général. Toit ouvrant, caméra de recul, sièges cuir. Aucun frais à prévoir." },
  { sellerKey: "riad", brand: "Fiat", model: "Tipo", year: 2020, mileage: 40000, price: 2400000, fuelType: "ESSENCE", gearbox: "MANUELLE", condition: "OCCASION", formula: "STANDARD", daysAgo: 9,
    description: "Fiat Tipo récente, faible kilométrage, première main. Climatisation automatique, écran tactile multimédia. Véhicule non fumeur." },
  { sellerKey: "riad", brand: "Seat", model: "Ibiza", year: 2015, mileage: 130000, price: 1750000, fuelType: "ESSENCE", gearbox: "MANUELLE", condition: "OCCASION", formula: "STANDARD", daysAgo: 18,
    description: "Seat Ibiza économique, entretien régulier documenté. Quelques traces d'usure sur l'intérieur, mécanique fiable. Bon rapport prix/kilométrage." },

  // Amel Ferhat — Blida
  { sellerKey: "amel", brand: "Dacia", model: "Sandero", year: 2021, mileage: 25000, price: 2050000, fuelType: "ESSENCE", gearbox: "MANUELLE", condition: "OCCASION", formula: "STANDARD", daysAgo: 2,
    description: "Dacia Sandero quasi neuve, très faible kilométrage. Sous garantie constructeur restante. Climatisation, Bluetooth, aucun défaut à signaler." },
  { sellerKey: "amel", brand: "Citroën", model: "C4", year: 2018, mileage: 95000, price: 2600000, fuelType: "DIESEL", gearbox: "MANUELLE", condition: "OCCASION", formula: "PREMIUM", daysAgo: 7,
    description: "Citroën C4 diesel, confortable et bien équipée. Climatisation automatique, régulateur de vitesse, rétroviseurs électriques. Entretien à jour." },
  { sellerKey: "amel", brand: "Suzuki", model: "Vitara", year: 2019, mileage: 60000, price: 3800000, fuelType: "ESSENCE", gearbox: "AUTOMATIQUE", condition: "OCCASION", formula: "STANDARD", daysAgo: 14,
    description: "Suzuki Vitara automatique, parfaite pour la ville comme les routes de montagne. Intérieur soigné, climatisation bi-zone. Un seul propriétaire." },

  // Sofiane Guerroudj — Sétif
  { sellerKey: "sofiane", brand: "Skoda", model: "Octavia", year: 2017, mileage: 110000, price: 2950000, fuelType: "DIESEL", gearbox: "MANUELLE", condition: "OCCASION", formula: "STANDARD", daysAgo: 6,
    description: "Skoda Octavia spacieuse, idéale pour les longs trajets. Coffre volumineux, climatisation, ordinateur de bord. Révision complète effectuée récemment." },
  { sellerKey: "sofiane", brand: "Ford", model: "Fiesta", year: 2016, mileage: 105000, price: 1900000, fuelType: "ESSENCE", gearbox: "MANUELLE", condition: "OCCASION", formula: "STANDARD", daysAgo: 11,
    description: "Ford Fiesta compacte et économique, entretien suivi. Climatisation fonctionnelle, pneus en bon état. Idéale pour un premier achat." },
  { sellerKey: "sofiane", brand: "Nissan", model: "Qashqai", year: 2020, mileage: 55000, price: 4900000, fuelType: "DIESEL", gearbox: "AUTOMATIQUE", condition: "OCCASION", formula: "STANDARD", daysAgo: 20,
    description: "Nissan Qashqai diesel, boîte automatique, très bon état. Caméra 360°, sièges chauffants, aide au stationnement. Carnet d'entretien complet." },

  // Nadia Bouzid — Annaba
  { sellerKey: "nadia", brand: "Renault", model: "Megane", year: 2018, mileage: 87000, price: 2650000, fuelType: "DIESEL", gearbox: "MANUELLE", condition: "OCCASION", formula: "STANDARD", daysAgo: 3,
    description: "Renault Megane confortable, bien entretenue. Climatisation automatique, GPS intégré, régulateur de vitesse. Aucun accident déclaré." },
  { sellerKey: "nadia", brand: "Chery", model: "Tiggo 7", year: 2022, mileage: 18000, price: 4200000, fuelType: "ESSENCE", gearbox: "AUTOMATIQUE", condition: "OCCASION", formula: "STANDARD", daysAgo: 10,
    description: "Chery Tiggo 7 récente, très faible kilométrage, sous garantie. Équipement complet : écran tactile, caméra de recul, sièges chauffants." },
  { sellerKey: "nadia", brand: "Opel", model: "Corsa", year: 2017, mileage: 98000, price: 1850000, fuelType: "ESSENCE", gearbox: "MANUELLE", condition: "OCCASION", formula: "STANDARD", daysAgo: 17,
    description: "Opel Corsa fiable et facile à garer en ville. Entretien régulier, climatisation, vitres électriques. Bon état général." },

  // Auto Sara Motors (compte professionnel existant, Alger) — stock concessionnaire
  { sellerKey: "sara", brand: "BMW", model: "Série 3", year: 2019, mileage: 62000, price: 7200000, fuelType: "DIESEL", gearbox: "AUTOMATIQUE", condition: "OCCASION", formula: "PREMIUM_PLUS", daysAgo: 2,
    description: "BMW Série 3 diesel, boîte automatique, finition haut de gamme. Sièges cuir, GPS, toit ouvrant. Véhicule garanti 6 mois par notre concession." },
  { sellerKey: "sara", brand: "Mercedes-Benz", model: "Classe C", year: 2018, mileage: 75000, price: 6900000, fuelType: "DIESEL", gearbox: "AUTOMATIQUE", condition: "OCCASION", formula: "PREMIUM", daysAgo: 4,
    description: "Mercedes Classe C élégante et bien équipée. Sièges chauffants, caméra de recul, régulateur adaptatif. Contrôle technique et garantie inclus." },
  { sellerKey: "sara", brand: "Audi", model: "Q3", year: 2020, mileage: 40000, price: 6500000, fuelType: "ESSENCE", gearbox: "AUTOMATIQUE", condition: "OCCASION", formula: "STANDARD", daysAgo: 6,
    description: "Audi Q3 essence, faible kilométrage, très bon état. Intérieur cuir, écran tactile, aide au stationnement. Reprise possible." },
  { sellerKey: "sara", brand: "Volkswagen", model: "Passat", year: 2017, mileage: 120000, price: 3600000, fuelType: "DIESEL", gearbox: "MANUELLE", condition: "OCCASION", formula: "STANDARD", daysAgo: 9,
    description: "Volkswagen Passat spacieuse, idéale pour les professionnels. Climatisation automatique, GPS, régulateur de vitesse. Entretien complet effectué." },
  { sellerKey: "sara", brand: "Toyota", model: "Corolla", year: 2021, mileage: 22000, price: 3900000, fuelType: "ESSENCE", gearbox: "AUTOMATIQUE", condition: "OCCASION", formula: "STANDARD", daysAgo: 13,
    description: "Toyota Corolla récente, très faible kilométrage, sous garantie constructeur. Fiabilité reconnue, consommation réduite. Véhicule non fumeur." },
  { sellerKey: "sara", brand: "Hyundai", model: "Elantra", year: 2019, mileage: 68000, price: 3100000, fuelType: "ESSENCE", gearbox: "MANUELLE", condition: "OCCASION", formula: "STANDARD", daysAgo: 16,
    description: "Hyundai Elantra confortable et économique. Climatisation, Bluetooth, vitres électriques. Historique d'entretien complet disponible." },
];

async function upsertDemoSeller(seller: DemoSeller): Promise<string> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: seller.email },
    update: {},
    create: {
      email: seller.email,
      passwordHash,
      role: "PARTICULIER",
      emailVerifiedAt: new Date(),
      profile: { create: { displayName: seller.displayName, wilayaId: seller.wilayaId } },
    },
  });
  return user.id;
}

async function main() {
  const brandCount = await prisma.brand.count();
  if (brandCount === 0) {
    throw new Error("Catalogue marques/modèles vide — lancez d'abord `npm run seed`.");
  }

  // Remplace le catalogue de test existant (8 annonces "Renault Clio 4
  // diesel" quasi identiques sur amine.benali) par un jeu de démonstration
  // cohérent — décision explicite du porteur de projet.
  const testSeller = await prisma.user.findUnique({ where: { email: "amine.benali@example.dz" } });
  if (testSeller) {
    const deleted = await prisma.listing.deleteMany({ where: { sellerId: testSeller.id } });
    console.log(`Anciennes annonces de test supprimées : ${deleted.count}`);
  }

  const sellerIdByKey = new Map<string, string>();
  for (const seller of DEMO_SELLERS) {
    const id = await upsertDemoSeller(seller);
    sellerIdByKey.set(seller.key, id);
  }
  const sara = await prisma.user.findUnique({ where: { email: "sara.hamdi@example.dz" } });
  if (!sara) {
    throw new Error("Compte sara.hamdi@example.dz introuvable — ce persona de test doit déjà exister.");
  }
  sellerIdByKey.set("sara", sara.id);
  console.log(`Vendeurs de démonstration prêts : ${sellerIdByKey.size}`);

  let created = 0;
  for (const item of LISTINGS) {
    const sellerId = sellerIdByKey.get(item.sellerKey);
    if (!sellerId) {
      throw new Error(`Vendeur inconnu pour la clé "${item.sellerKey}"`);
    }

    const brandRow = await prisma.brand.findUnique({ where: { slug: slugify(item.brand) } });
    const modelRow = brandRow
      ? await prisma.model.findUnique({ where: { brandId_slug: { brandId: brandRow.id, slug: slugify(item.model) } } })
      : null;
    if (!brandRow || !modelRow) {
      throw new Error(`Marque/modèle introuvable au catalogue : ${item.brand} ${item.model}`);
    }

    const seller = DEMO_SELLERS.find((s) => s.key === item.sellerKey);
    const wilayaId = seller ? seller.wilayaId : 16; // Alger pour Auto Sara Motors

    const publishedAt = new Date(Date.now() - item.daysAgo * 24 * 60 * 60 * 1000);
    const expiresAt = computeExpiryDate(publishedAt, formulaValidityDays(item.formula));

    const listing = await prisma.listing.create({
      data: {
        sellerId,
        category: "VOITURE",
        brandId: brandRow.id,
        modelId: modelRow.id,
        title: `${item.brand} ${item.model} ${item.year}`,
        description: item.description,
        price: item.price,
        year: item.year,
        mileage: item.mileage,
        fuelType: item.fuelType,
        gearbox: item.gearbox,
        condition: item.condition,
        wilayaId,
        formula: item.formula,
        status: "PUBLIEE",
        createdAt: publishedAt,
        publishedAt,
        expiresAt,
      },
    });

    const photoPath = await generatePlaceholderPhoto(item.brand, item.model);
    await prisma.listingPhoto.create({ data: { listingId: listing.id, path: photoPath, position: 0 } });

    created += 1;
  }

  console.log(`Annonces de démonstration créées : ${created}`);
  console.log(`Mot de passe des comptes vendeurs de démonstration : ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
