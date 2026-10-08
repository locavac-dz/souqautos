// Lot 265 (audit 2026-10-08, constat A2) — rattrapage : les annonces publiées AVANT ce lot n'ont jamais reçu de
// date d'expiration (ni la création ni l'approbation ne l'écrivaient). Ce script la pose.
//
//   npx tsx scripts/backfill-listing-expiry.ts                 — simulation : compte et montre ce qui serait fait
//   npx tsx scripts/backfill-listing-expiry.ts --apply         — applique
//   npx tsx scripts/backfill-listing-expiry.ts --apply --grace-days 14
//
// Règle : expiresAt = max(publishedAt + durée de la formule, maintenant + délai de grâce). Le délai de grâce
// (7 jours par défaut) évite qu'une annonce ancienne mais encore active expire dès le balayage suivant sans que
// le vendeur ait reçu le rappel habituel (envoyé quelques jours avant l'échéance).
import { PrismaClient, type ListingFormula } from "@prisma/client";
import { formulaValidityDays } from "../src/lib/payment-orders";
import { computeExpiryDate } from "../src/lib/listing-lifecycle";

const apply = process.argv.includes("--apply");
const graceArg = process.argv.indexOf("--grace-days");
const graceDays = graceArg >= 0 ? Number(process.argv[graceArg + 1]) : 7;
if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 60) {
  console.error("--grace-days doit être un entier entre 0 et 60");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const listings = await prisma.listing.findMany({
    where: { status: "PUBLIEE", expiresAt: null },
    select: { id: true, title: true, formula: true, publishedAt: true, createdAt: true },
    orderBy: { publishedAt: "asc" },
  });
  console.log(`${listings.length} annonce(s) publiée(s) sans date d'expiration${apply ? "" : " (simulation : ajouter --apply pour écrire)"}.`);

  const floor = computeExpiryDate(now, graceDays);
  let updated = 0;
  for (const listing of listings) {
    const from = listing.publishedAt ?? listing.createdAt;
    const natural = computeExpiryDate(from, formulaValidityDays(listing.formula as ListingFormula));
    const expiresAt = natural > floor ? natural : floor;
    console.log(`  ${listing.id}  ${listing.formula.padEnd(12)}  publiée ${from.toISOString().slice(0, 10)}  → expire ${expiresAt.toISOString().slice(0, 10)}  ${listing.title}`);
    if (apply) {
      const { count } = await prisma.listing.updateMany({
        where: { id: listing.id, status: "PUBLIEE", expiresAt: null },
        data: { expiresAt, expiryReminderSentAt: null },
      });
      updated += count;
    }
  }
  if (apply) console.log(`${updated} annonce(s) mise(s) à jour.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
