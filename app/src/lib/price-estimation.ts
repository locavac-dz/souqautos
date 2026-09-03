import { prisma } from "@/lib/prisma";

export type EstimateResult = {
  low: number;
  mid: number;
  high: number;
  sampleSize: number;
  confidencePct: number;
  confidenceLabel: "faible" | "moyenne" | "bonne" | "elevee";
  appliedFilters: { year: boolean; mileage: boolean; wilaya: boolean };
};

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Formule heuristique simple (pas de calibration statistique réelle tant que le
// volume d'annonces reste faible) — jamais présentée comme une certitude, cf.
// docs/ARCHITECTURE.md §14 : « Estimation indicative basée sur les données
// disponibles sur le marché ».
function confidenceFromSampleSize(n: number): { pct: number; label: EstimateResult["confidenceLabel"] } {
  if (n >= 15) return { pct: Math.min(92, 25 + n * 4), label: "elevee" };
  if (n >= 6) return { pct: 25 + n * 6, label: "bonne" };
  if (n >= 3) return { pct: 25 + n * 8, label: "moyenne" };
  return { pct: 20 + n * 5, label: "faible" };
}

export function computeEstimateFromPrices(
  prices: number[]
): Omit<EstimateResult, "appliedFilters"> | null {
  if (prices.length === 0) return null;

  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.round(median(sorted));
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  const { pct, label } = confidenceFromSampleSize(sorted.length);

  return { low, mid, high, sampleSize: sorted.length, confidencePct: pct, confidenceLabel: label };
}

const YEAR_WINDOW = 2;
const MILEAGE_BAND_RATIO = 0.3; // +/- 30%

type EstimateQuery = {
  brandId: number;
  modelId: number;
  year?: number;
  mileage?: number;
  wilayaId?: number;
  excludeListingId?: string;
};

type ComparableRow = { id: string; price: number; year: number; mileage: number; wilayaId: number };

type Tier = { year: boolean; mileage: boolean; wilaya: boolean };

function buildTiers(query: { year?: number; mileage?: number; wilayaId?: number }): Tier[] {
  const tiers: Tier[] = [
    { year: Boolean(query.year), mileage: Boolean(query.mileage), wilaya: Boolean(query.wilayaId) },
    { year: Boolean(query.year), mileage: Boolean(query.mileage), wilaya: false },
    { year: Boolean(query.year), mileage: false, wilaya: false },
    { year: false, mileage: false, wilaya: false },
  ];

  // Ne garder que des paliers distincts (évite de refaire deux fois la même
  // combinaison quand un des critères n'a pas été fourni par l'appelant).
  const seen = new Set<string>();
  return tiers.filter((t) => {
    const key = `${t.year}-${t.mileage}-${t.wilaya}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchesTier(
  row: ComparableRow,
  query: { year?: number; mileage?: number; wilayaId?: number },
  tier: Tier
): boolean {
  if (tier.year && query.year !== undefined) {
    if (row.year < query.year - YEAR_WINDOW || row.year > query.year + YEAR_WINDOW) return false;
  }
  if (tier.mileage && query.mileage !== undefined) {
    const lo = query.mileage * (1 - MILEAGE_BAND_RATIO);
    const hi = query.mileage * (1 + MILEAGE_BAND_RATIO);
    if (row.mileage < lo || row.mileage > hi) return false;
  }
  if (tier.wilaya && query.wilayaId !== undefined && row.wilayaId !== query.wilayaId) return false;
  return true;
}

// Essaie des filtres du plus précis au plus large : dès qu'un niveau donne au
// moins un résultat, on s'arrête et on indique honnêtement quels critères ont
// réellement été pris en compte (cf. commentaire de tête). Opère en mémoire sur
// un jeu de lignes déjà chargé — permet à l'appelant de charger les
// comparables une seule fois pour toute une page de résultats plutôt qu'une
// requête par annonce (cf. estimatePricesForListings ci-dessous).
export function estimateFromRows(
  rows: ComparableRow[],
  query: { year?: number; mileage?: number; wilayaId?: number; excludeListingId?: string }
): EstimateResult | null {
  const candidates = query.excludeListingId ? rows.filter((r) => r.id !== query.excludeListingId) : rows;

  for (const tier of buildTiers(query)) {
    const matched = candidates.filter((r) => matchesTier(r, query, tier));
    if (matched.length > 0) {
      const base = computeEstimateFromPrices(matched.map((r) => r.price));
      if (!base) continue;
      return { ...base, appliedFilters: tier };
    }
  }

  return null;
}

// Une seule requête (le palier le plus large, sans filtre) : le classement du
// plus précis au plus large se fait ensuite en mémoire via estimateFromRows,
// au lieu d'une requête par palier essayé.
export async function estimatePrice(query: EstimateQuery): Promise<EstimateResult | null> {
  const rows = await prisma.listing.findMany({
    where: {
      status: "PUBLIEE",
      brandId: query.brandId,
      modelId: query.modelId,
    },
    select: { id: true, price: true, year: true, mileage: true, wilayaId: true },
  });

  return estimateFromRows(rows, query);
}

type ListingForBatchEstimate = {
  id: string;
  brandId: number | null;
  modelId: number | null;
  year: number;
  mileage: number;
  wilayaId: number;
};

// Version batch pour une page de résultats entière : une requête par couple
// (marque, modèle) DISTINCT présent sur la page (exécutées en parallèle),
// jamais une requête par annonce — évite le N+1 qui avait fait reporter le
// badge « Bon Prix » sur les cartes de résultats depuis le Lot 4.
export async function estimatePricesForListings(
  listings: ListingForBatchEstimate[]
): Promise<Map<string, EstimateResult | null>> {
  const pairs = new Map<string, { brandId: number; modelId: number }>();
  for (const listing of listings) {
    if (listing.brandId && listing.modelId) {
      pairs.set(`${listing.brandId}-${listing.modelId}`, {
        brandId: listing.brandId,
        modelId: listing.modelId,
      });
    }
  }

  const rowsByPair = new Map<string, ComparableRow[]>();
  await Promise.all(
    Array.from(pairs.entries()).map(async ([key, { brandId, modelId }]) => {
      const rows = await prisma.listing.findMany({
        where: { status: "PUBLIEE", brandId, modelId },
        select: { id: true, price: true, year: true, mileage: true, wilayaId: true },
      });
      rowsByPair.set(key, rows);
    })
  );

  const results = new Map<string, EstimateResult | null>();
  for (const listing of listings) {
    if (!listing.brandId || !listing.modelId) {
      results.set(listing.id, null);
      continue;
    }
    const rows = rowsByPair.get(`${listing.brandId}-${listing.modelId}`) ?? [];
    results.set(
      listing.id,
      estimateFromRows(rows, {
        year: listing.year,
        mileage: listing.mileage,
        wilayaId: listing.wilayaId,
        excludeListingId: listing.id,
      })
    );
  }

  return results;
}
