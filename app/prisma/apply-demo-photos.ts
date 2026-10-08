// Lot 125 — remplace, sur une base qui contient DÉJÀ les annonces de démonstration, leurs visuels de
// substitution (cartes de couleur) par les vraies photos de `prisma/demo-photos/`.
//
//   npm run db:demo-photos          — pose les vraies photos là où il n'y en a pas encore
//   npm run db:demo-photos -- --force  — régénère TOUTES les photos (utile après un changement
//                                       du badge DÉMO ou du traitement d'image)
//
// Ne touche qu'aux annonces des comptes de démonstration (adresses @example.dz). Sur une base neuve,
// `npm run db:seed:demo` pose directement les vraies photos ; ce script sert à mettre à niveau une base existante.

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { deleteStoredFile, storeProcessedImage } from "../src/lib/uploads";
import { loadDemoPhotoCredits, storeDemoPhoto } from "./demo-photo-store";

const prisma = new PrismaClient();
const force = process.argv.includes("--force");

const BRAND_COLORS: Record<string, string> = {
  Renault: "#1B3A6B", Dacia: "#2B6E4F", Volkswagen: "#173A5E", Peugeot: "#1F2937",
  Hyundai: "#0F4C81", Toyota: "#7F1D1D", Kia: "#4C1D95", Fiat: "#B45309",
  Seat: "#B91C1C", Citroën: "#0E7490", Suzuki: "#1D4ED8", Skoda: "#065F46",
  Ford: "#1E3A8A", Nissan: "#374151", Opel: "#78350F",
  "Mercedes-Benz": "#111827", BMW: "#1E3A8A", Audi: "#27272A", Chery: "#7C2D12",
  Thule: "#CC3300", Noco: "#003366",
};

function escapeXml(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function generatePlaceholderWithBadge(label1: string, label2: string): Promise<string> {
  const color = BRAND_COLORS[label1] ?? "#334155";
  const svg = `<svg width="1200" height="900" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${color}"/>
    <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="72" fill="#ffffff" text-anchor="middle" font-weight="bold">${escapeXml(label1)}</text>
    <text x="50%" y="58%" font-family="Arial, sans-serif" font-size="44" fill="#e2e8f0" text-anchor="middle">${escapeXml(label2)}</text>
    <rect x="522" y="824" width="156" height="52" rx="8" fill="rgba(0,0,0,0.62)"/>
    <text x="600" y="859" font-family="Arial, sans-serif" font-size="26" fill="#ffffff" text-anchor="middle" font-weight="bold" letter-spacing="5">D&#201;MO</text>
  </svg>`;
  const output = await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
  const filename = `${randomUUID()}.jpg`;
  const storedPath = await storeProcessedImage("listings", filename, output);
  return storedPath;
}

async function main() {
  if (force) console.log("Mode --force : toutes les photos seront régénérées.");
  const credits = loadDemoPhotoCredits();
  const listings = await prisma.listing.findMany({
    where: { seller: { email: { endsWith: "@example.dz" } } },
    select: {
      id: true, title: true, category: true,
      brandFreeText: true, modelFreeText: true,
      brand: { select: { name: true } },
      model: { select: { name: true } },
      photos: { orderBy: { position: "asc" }, select: { id: true, path: true, creditAuthor: true } },
    },
  });

  let replaced = 0;
  let skipped = 0;
  const missing: string[] = [];

  for (const listing of listings) {
    const first = listing.photos[0];
    if (first?.creditAuthor && !force) { skipped += 1; continue; }

    // Véhicules : clé CREDITS = « Marque Modèle » du catalogue. Équipements (sans relation catalogue) :
    // clé = « brandFreeText modelFreeText », avec « Équipement » à défaut de marque.
    const label1 = listing.brand?.name ?? listing.brandFreeText ?? "Équipement";
    const label2 = listing.model?.name ?? listing.modelFreeText ?? listing.title;
    const key = `${label1} ${label2}`;

    const oldPath = first?.path;
    let newPath: string | null = null;
    let stored = null;

    if (credits[key]) {
      // Vraie photo Wikimedia — storeDemoPhoto ajoute le badge DÉMO.
      stored = await storeDemoPhoto(label1, label2);
      newPath = stored?.path ?? null;
    } else {
      // Placeholder SVG — généré avec badge DÉMO.
      newPath = await generatePlaceholderWithBadge(label1, label2);
    }

    if (!newPath) { missing.push(listing.title); continue; }

    const photoData = stored
      ? { ...stored }
      : { path: newPath, sha256: "", qualityFlags: JSON.stringify([]), creditAuthor: null, creditLicense: null, creditLicenseUrl: null, creditSourceUrl: null };

    if (first) {
      await prisma.listingPhoto.update({ where: { id: first.id }, data: photoData });
      if (oldPath && oldPath !== newPath) {
        const stillUsed = await prisma.listingPhoto.count({ where: { path: oldPath } });
        if (stillUsed === 0) await deleteStoredFile(oldPath).catch(() => undefined);
      }
    } else {
      await prisma.listingPhoto.create({ data: { listingId: listing.id, position: 0, ...photoData } });
    }
    replaced += 1;
  }

  console.log(`Photos régénérées : ${replaced} ; ignorées : ${skipped} ; sans solution : ${missing.length}`);
  for (const title of missing) console.log(`  - ${title}`);
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(() => prisma.$disconnect());
