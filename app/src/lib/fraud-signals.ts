import { prisma } from "@/lib/prisma";
import { estimateFromRows, type EstimateResult } from "@/lib/price-estimation";

// Lot 77 — première brique du "Système anti-fraude" documenté depuis le Lot 0
// (docs/ARCHITECTURE.md §16 : "Règles + IA : détection de prix anormalement
// bas, photos dupliquées inter-annonces, comptes/comportements suspects,
// incohérences véhicule/prix, spam") mais jamais construit jusqu'ici — seul
// le circuit réactif de signalement par les utilisateurs existait (Lot 21).
// Ici : deux règles simples, jamais une "IA" fabriquée sans base réelle.
// Ces signaux sont uniquement des AIDES à la décision du modérateur humain —
// jamais un rejet ou une accusation automatique (§16 : "bandeau d'avertissement
// non accusatoire").

export type FraudSignals = {
  duplicatePhoto: boolean;
  lowPrice: boolean;
};

// Une photo strictement identique (mêmes octets stockés) publiée par un AUTRE
// vendeur est un indice de photo volée/copiée depuis une autre annonce — un
// vendeur qui réutilise ses PROPRES photos d'une annonce à l'autre est normal
// et n'est jamais signalé.
export function detectDuplicatePhoto(
  ownSellerId: string,
  ownHashes: string[],
  otherPhotos: { sha256: string; sellerId: string }[]
): boolean {
  const ownHashSet = new Set(ownHashes.filter((h) => h !== ""));
  if (ownHashSet.size === 0) return false;
  return otherPhotos.some((p) => p.sellerId !== ownSellerId && ownHashSet.has(p.sha256));
}

// Seuil volontairement strict (bien en dessous du badge "Bon Prix" qui
// commence dès -15%, cf. src/lib/price-badge.ts) : ce signal ne vise pas les
// bonnes affaires légitimes, seulement un prix qui n'a économiquement plus de
// sens face aux comparables réels — signe classique d'une annonce-appât.
export const LOW_PRICE_RATIO = 0.5;
const MIN_SAMPLE_SIZE_FOR_LOW_PRICE_SIGNAL = 3;

export function detectLowPrice(price: number, estimate: EstimateResult | null): boolean {
  if (!estimate || estimate.sampleSize < MIN_SAMPLE_SIZE_FOR_LOW_PRICE_SIGNAL) return false;
  return price < estimate.low * LOW_PRICE_RATIO;
}

type ListingForFraudSignals = {
  id: string;
  sellerId: string;
  price: number;
  brandId: number | null;
  modelId: number | null;
  year: number;
  mileage: number;
  wilayaId: number;
  photos: { sha256: string }[];
};

// Version batch pour la file de modération : une seule requête pour toutes les
// photos existantes potentiellement concernées, une seule requête par couple
// marque/modèle DISTINCT pour l'estimation — même principe que
// estimatePricesForListings (Lot 4/72), jamais une requête par annonce.
export async function getFraudSignalsForListings(
  listings: ListingForFraudSignals[]
): Promise<Map<string, FraudSignals>> {
  const allHashes = Array.from(
    new Set(listings.flatMap((l) => l.photos.map((p) => p.sha256)).filter((h) => h !== ""))
  );

  const matchingPhotos =
    allHashes.length === 0
      ? []
      : await prisma.listingPhoto.findMany({
          where: { sha256: { in: allHashes } },
          select: { sha256: true, listing: { select: { sellerId: true } } },
        });
  const otherPhotos = matchingPhotos.map((p) => ({ sha256: p.sha256, sellerId: p.listing.sellerId }));

  const pairs = new Map<string, { brandId: number; modelId: number }>();
  for (const listing of listings) {
    if (listing.brandId && listing.modelId) {
      pairs.set(`${listing.brandId}-${listing.modelId}`, { brandId: listing.brandId, modelId: listing.modelId });
    }
  }
  const rowsByPair = new Map<string, Awaited<ReturnType<typeof loadComparableRows>>>();
  await Promise.all(
    Array.from(pairs.entries()).map(async ([key, { brandId, modelId }]) => {
      rowsByPair.set(key, await loadComparableRows(brandId, modelId));
    })
  );

  const results = new Map<string, FraudSignals>();
  for (const listing of listings) {
    const duplicatePhoto = detectDuplicatePhoto(
      listing.sellerId,
      listing.photos.map((p) => p.sha256),
      otherPhotos
    );

    let lowPrice = false;
    if (listing.brandId && listing.modelId) {
      const rows = rowsByPair.get(`${listing.brandId}-${listing.modelId}`) ?? [];
      const estimate = estimateFromRows(rows, {
        year: listing.year,
        mileage: listing.mileage,
        wilayaId: listing.wilayaId,
        excludeListingId: listing.id,
      });
      lowPrice = detectLowPrice(listing.price, estimate);
    }

    results.set(listing.id, { duplicatePhoto, lowPrice });
  }

  return results;
}

async function loadComparableRows(brandId: number, modelId: number) {
  const rows = await prisma.listing.findMany({
    where: { status: "PUBLIEE", brandId, modelId },
    select: { id: true, price: true, year: true, mileage: true, wilayaId: true },
  });
  return rows;
}
