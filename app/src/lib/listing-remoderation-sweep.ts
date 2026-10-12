import { prisma } from "@/lib/prisma";
import {
  getFraudSignalsForListings,
  computeFraudScore,
  type FraudSignals,
  FRAUD_SIGNAL_WEIGHTS,
} from "@/lib/fraud-signals";

// Lot 303 — balayage cron de re-modération : re-calcule les signaux de fraude
// sur les annonces PUBLIÉES dont le dernier contrôle remonte à plus de
// RECHECK_INTERVAL_DAYS jours. Détecte les doublons (photos, contenu, VIN)
// apparus APRÈS la publication initiale — signaux impossibles à détecter lors
// de la première vérification. Ne suspend jamais automatiquement : l'équipe
// humaine tranche toujours.

export const RECHECK_INTERVAL_DAYS = 7;
export const BATCH_SIZE = 200;

export type FlaggedListing = {
  id: string;
  title: string;
  oldScore: number;
  newScore: number;
  signals: (keyof FraudSignals)[];
};

export type RemoderationResult = {
  checked: number;
  flagged: FlaggedListing[];
};

export function activeSignalKeys(signals: FraudSignals): (keyof FraudSignals)[] {
  return (Object.keys(FRAUD_SIGNAL_WEIGHTS) as (keyof FraudSignals)[]).filter(
    (k) => signals[k],
  );
}

export async function sweepListingRemoderation(
  now: Date = new Date(),
): Promise<RemoderationResult> {
  const cutoff = new Date(
    now.getTime() - RECHECK_INTERVAL_DAYS * 24 * 60 * 60 * 1000,
  );

  const listings = await prisma.listing.findMany({
    where: {
      status: "PUBLIEE",
      OR: [{ fraudCheckedAt: { lt: cutoff } }, { fraudCheckedAt: null }],
    },
    select: {
      id: true,
      sellerId: true,
      title: true,
      price: true,
      brandId: true,
      modelId: true,
      year: true,
      mileage: true,
      wilayaId: true,
      condition: true,
      contentHash: true,
      vin: true,
      fraudScore: true,
      photos: { select: { sha256: true } },
    },
    orderBy: { fraudCheckedAt: { sort: "asc", nulls: "first" } },
    take: BATCH_SIZE,
  });

  if (listings.length === 0) return { checked: 0, flagged: [] };

  const signalsMap = await getFraudSignalsForListings(listings);

  const flagged: FlaggedListing[] = [];

  const updates = listings.map((listing) => {
    const signals = signalsMap.get(listing.id);
    if (!signals)
      return prisma.listing.update({
        where: { id: listing.id },
        data: { fraudCheckedAt: now },
      });

    const newScore = computeFraudScore(signals);

    if (newScore > listing.fraudScore && newScore > 0) {
      flagged.push({
        id: listing.id,
        title: listing.title,
        oldScore: listing.fraudScore,
        newScore,
        signals: activeSignalKeys(signals),
      });
    }

    return prisma.listing.update({
      where: { id: listing.id },
      data: { fraudScore: newScore, fraudCheckedAt: now },
    });
  });

  await Promise.all(updates);

  return { checked: listings.length, flagged };
}
