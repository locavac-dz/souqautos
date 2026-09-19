// Lot 125 — remplace, sur une base qui contient DÉJÀ les annonces de démonstration, leurs visuels de
// substitution (cartes de couleur) par les vraies photos de `prisma/demo-photos/`.
//
//   npm run db:demo-photos
//
// Ne touche qu'aux annonces des comptes de démonstration (adresses @example.dz) dont le titre est
// « Marque Modèle Année » et pour lesquelles une photo existe. Idempotent : une photo déjà en place
// (crédit présent) n'est pas refaite. Sur une base neuve, `npm run db:seed:demo` pose directement
// les vraies photos ; ce script sert à mettre à niveau une base créée avant le Lot 125.

import { PrismaClient } from "@prisma/client";
import { deleteStoredFile } from "../src/lib/uploads";
import { loadDemoPhotoCredits, storeDemoPhoto } from "./demo-photo-store";

const prisma = new PrismaClient();

async function main() {
  const credits = loadDemoPhotoCredits();
  const listings = await prisma.listing.findMany({
    where: { seller: { email: { endsWith: "@example.dz" } } },
    select: { id: true, title: true, brand: { select: { name: true } }, model: { select: { name: true } }, photos: { orderBy: { position: "asc" }, select: { id: true, path: true, creditAuthor: true } } },
  });

  let replaced = 0;
  let already = 0;
  const missing: string[] = [];
  for (const listing of listings) {
    const key = `${listing.brand?.name} ${listing.model?.name}`;
    if (!credits[key]) {
      missing.push(listing.title);
      continue;
    }
    const first = listing.photos[0];
    if (first?.creditAuthor) {
      already += 1;
      continue;
    }

    const stored = await storeDemoPhoto(listing.brand!.name, listing.model!.name);
    if (!stored) continue;
    if (first) {
      await prisma.listingPhoto.update({ where: { id: first.id }, data: { ...stored } });
      // L'ancien visuel de substitution n'est plus référencé : on le supprime du stockage.
      const stillUsed = await prisma.listingPhoto.count({ where: { path: first.path } });
      if (stillUsed === 0) await deleteStoredFile(first.path).catch(() => undefined);
    } else {
      await prisma.listingPhoto.create({ data: { listingId: listing.id, position: 0, ...stored } });
    }
    replaced += 1;
  }

  console.log(`Photos remplacées : ${replaced} ; déjà en place : ${already} ; sans photo disponible : ${missing.length}`);
  for (const title of missing) console.log(`  - ${title}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
