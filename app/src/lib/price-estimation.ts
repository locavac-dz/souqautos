import { prisma } from "@/lib/prisma";
import { cachedReference } from "@/lib/reference-data";

export type EstimateResult = {
  low: number;
  mid: number;
  high: number;
  sampleSize: number;
  confidencePct: number;
  confidenceLabel: "faible" | "moyenne" | "bonne" | "elevee";
  appliedFilters: { year: boolean; mileage: boolean; wilaya: boolean; equipment: boolean };
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
  if (n >= 6) return { pct: Math.min(92, 25 + n * 6), label: "bonne" };
  if (n >= 3) return { pct: Math.min(92, 25 + n * 8), label: "moyenne" };
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
// Lot 72 — un comparable est jugé « équipé similairement » s'il partage au
// moins la moitié des équipements du véhicule estimé (cf. docs/ARCHITECTURE.md
// §14 : équipements fait partie des critères de comparabilité, au même titre
// qu'année/km/wilaya). Jamais un pourcentage d'ajustement de prix par
// équipement inventé sans base de marché réelle — seulement un critère de
// sélection du pool de comparables, comme les trois autres.
const EQUIPMENT_OVERLAP_RATIO = 0.5;

type EstimateQuery = {
  brandId: number;
  modelId: number;
  year?: number;
  mileage?: number;
  wilayaId?: number;
  equipmentIds?: number[];
  excludeListingId?: string;
};

type ComparableRow = {
  id: string;
  price: number;
  year: number;
  mileage: number | null;
  wilayaId: number;
  equipmentIds?: number[];
};

type Tier = { year: boolean; mileage: boolean; wilaya: boolean; equipment: boolean };

function buildTiers(query: {
  year?: number;
  mileage?: number;
  wilayaId?: number;
  equipmentIds?: number[];
}): Tier[] {
  const hasEquipment = Boolean(query.equipmentIds && query.equipmentIds.length > 0);
  const tiers: Tier[] = [
    {
      year: Boolean(query.year),
      mileage: Boolean(query.mileage),
      wilaya: Boolean(query.wilayaId),
      equipment: hasEquipment,
    },
    { year: Boolean(query.year), mileage: Boolean(query.mileage), wilaya: Boolean(query.wilayaId), equipment: false },
    { year: Boolean(query.year), mileage: Boolean(query.mileage), wilaya: false, equipment: false },
    { year: Boolean(query.year), mileage: false, wilaya: false, equipment: false },
    { year: false, mileage: false, wilaya: false, equipment: false },
  ];

  // Ne garder que des paliers distincts (évite de refaire deux fois la même
  // combinaison quand un des critères n'a pas été fourni par l'appelant).
  const seen = new Set<string>();
  return tiers.filter((t) => {
    const key = `${t.year}-${t.mileage}-${t.wilaya}-${t.equipment}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchesEquipment(rowEquipmentIds: number[], queryEquipmentIds: number[]): boolean {
  if (queryEquipmentIds.length === 0) return true;
  // Lot 140 — même calcul qu'avant (on compte les équipements demandés présents sur la ligne), mais sans créer un Set par
  // ligne comparée : ces listes font au plus quelques dizaines d'éléments, et ce test est exécuté des milliers de fois par page.
  let shared = 0;
  for (const id of queryEquipmentIds) if (rowEquipmentIds.includes(id)) shared += 1;
  return shared / queryEquipmentIds.length >= EQUIPMENT_OVERLAP_RATIO;
}

function matchesTier(
  row: ComparableRow,
  query: { year?: number; mileage?: number; wilayaId?: number; equipmentIds?: number[] },
  tier: Tier
): boolean {
  if (tier.year && query.year !== undefined) {
    if (row.year < query.year - YEAR_WINDOW || row.year > query.year + YEAR_WINDOW) return false;
  }
  if (tier.mileage && query.mileage !== undefined && row.mileage != null) {
    const lo = query.mileage * (1 - MILEAGE_BAND_RATIO);
    const hi = query.mileage * (1 + MILEAGE_BAND_RATIO);
    if (row.mileage < lo || row.mileage > hi) return false;
  }
  if (tier.wilaya && query.wilayaId !== undefined && row.wilayaId !== query.wilayaId) return false;
  if (tier.equipment && !matchesEquipment(row.equipmentIds ?? [], query.equipmentIds ?? [])) return false;
  return true;
}

type EstimateQueryInput = {
  year?: number;
  mileage?: number;
  wilayaId?: number;
  equipmentIds?: number[];
  excludeListingId?: string;
};

// Lot 140 — les comparables d'un modèle, RANGÉS PAR ANNÉE.
//
// Tous les paliers sauf le dernier filtrent sur l'année (± 2 ans) : les ranger par année une fois permet de ne parcourir
// que la tranche utile au lieu de toutes les annonces du modèle, à chaque palier et pour chaque carte de la page. Mesuré à
// 100 000 annonces : une page de recherche parcourait 116 642 lignes (16,15 ms de processeur), dont 6,83 ms passées à
// RECOPIER les lignes pour en exclure l'annonce affichée — copie désormais supprimée (l'exclusion se fait au passage).
// Les résultats sont identiques : mêmes lignes retenues, et le calcul trie de toute façon les prix.
//
// `byYear` est un objet ordinaire (et non une Map) pour que le gel en profondeur du cache (src/lib/reference-data.ts)
// atteigne aussi les tranches : une valeur partagée entre toutes les visites ne doit être modifiable par personne.
export type ComparableIndex = { all: ComparableRow[]; byYear: Record<number, ComparableRow[]> };

const EMPTY_INDEX: ComparableIndex = { all: [], byYear: {} };

export function indexComparables(rows: ComparableRow[]): ComparableIndex {
  const byYear: Record<number, ComparableRow[]> = {};
  for (const row of rows) (byYear[row.year] ??= []).push(row);
  return { all: rows, byYear };
}

// Les tranches de lignes à parcourir pour un palier : celles des années utiles, ou tout le modèle pour le palier sans filtre.
// Ce n'est qu'un PRÉ-FILTRE : la règle reste `matchesTier`, qui revérifie l'année. Une tranche trop large ne change donc rien
// au résultat (seulement au coût) ; une tranche trop étroite, si — c'est ce que vérifient les tests d'équivalence.
function groupsForTier(index: ComparableIndex, query: EstimateQueryInput, tier: Tier): ComparableRow[][] {
  if (!tier.year || query.year === undefined) return [index.all];
  const groups: ComparableRow[][] = [];
  // Bornes entières : une année demandée non entière ne doit élargir la fenêtre dans aucun sens.
  for (let year = Math.ceil(query.year - YEAR_WINDOW); year <= Math.floor(query.year + YEAR_WINDOW); year++) {
    const rows = index.byYear[year];
    if (rows) groups.push(rows);
  }
  return groups;
}

// Essaie des filtres du plus précis au plus large : dès qu'un niveau donne au
// moins un résultat, on s'arrête et on indique honnêtement quels critères ont
// réellement été pris en compte (cf. commentaire de tête). Opère en mémoire sur
// un jeu de lignes déjà chargé — permet à l'appelant de charger les
// comparables une seule fois pour toute une page de résultats plutôt qu'une
// requête par annonce (cf. estimatePricesForListings ci-dessous).
export function estimateFromIndex(index: ComparableIndex, query: EstimateQueryInput): EstimateResult | null {
  for (const tier of buildTiers(query)) {
    const prices: number[] = [];
    for (const group of groupsForTier(index, query, tier)) {
      for (const row of group) {
        // L'annonce ne se compare jamais à elle-même (`excludeListingId`) : testé au passage, sans recopier le tableau.
        if (row.id === query.excludeListingId) continue;
        if (matchesTier(row, query, tier)) prices.push(row.price);
      }
    }
    const base = computeEstimateFromPrices(prices);
    if (base) return { ...base, appliedFilters: tier };
  }

  return null;
}

// Même chose à partir d'une simple liste de lignes : pour un appel isolé, ou quand le rangement par année ne serait pas
// rentabilisé. Un appelant qui estime PLUSIEURS annonces sur le même jeu de lignes range une fois (indexComparables) et
// appelle estimateFromIndex.
export function estimateFromRows(rows: ComparableRow[], query: EstimateQueryInput): EstimateResult | null {
  return estimateFromIndex(indexComparables(rows), query);
}

// Lot 137 — les comparables d'un couple (marque, modèle) : TOUTES ses annonces publiées (le palier le plus large de
// l'estimation les exige : « tout le marché du modèle »). Mesuré sur 20 000 annonces : pour une Renault Clio, 3 855 lignes et
// leurs équipements (une requête à 3 855 paramètres) rechargés à CHAQUE page de recherche, pour chaque modèle affiché — le
// client de base de données passait 42 % du temps du serveur à les décoder, et le coût croît avec le nombre d'annonces.
//
// Les mêmes lignes servent donc toutes les visites pendant 60 secondes (chargements simultanés regroupés, cf.
// src/lib/reference-data.ts) : le calcul de l'estimation est INCHANGÉ, seule la relecture de la base est évitée. Contrepartie
// assumée : une annonce publiée, vendue ou dont le prix change n'entre dans les estimations (badge « bon prix », cote) qu'au
// plus 60 secondes plus tard ; les annonces elles-mêmes, leurs prix et leur statut affichés sont toujours à jour.
export const COMPARABLES_TTL_MS = 60 * 1000;

// Lot 140 — le rangement par année est fait UNE fois, à l'intérieur du cache : toutes les visites des 60 secondes suivantes
// s'en servent, aucune page ne le refait.
async function loadComparableIndex(brandId: number, modelId: number): Promise<ComparableIndex> {
  return cachedReference(
    `comparables:${brandId}-${modelId}`,
    async () => {
      const rows = await prisma.listing.findMany({
        where: { status: "PUBLIEE", brandId, modelId },
        select: {
          id: true,
          price: true,
          year: true,
          mileage: true,
          wilayaId: true,
          equipments: { select: { equipmentId: true } },
        },
      });
      return indexComparables(rows.map(({ equipments, ...r }) => ({ ...r, equipmentIds: equipments.map((e) => e.equipmentId) })));
    },
    { ttlMs: COMPARABLES_TTL_MS },
  );
}

// Une seule lecture (le palier le plus large, sans filtre) : le classement du
// plus précis au plus large se fait ensuite en mémoire via estimateFromIndex,
// au lieu d'une requête par palier essayé.
export async function estimatePrice(query: EstimateQuery): Promise<EstimateResult | null> {
  return estimateFromIndex(await loadComparableIndex(query.brandId, query.modelId), query);
}

type ListingForBatchEstimate = {
  id: string;
  brandId: number | null;
  modelId: number | null;
  year: number;
  mileage: number | null;
  wilayaId: number;
  equipmentIds?: number[];
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

  const indexByPair = new Map<string, ComparableIndex>();
  await Promise.all(
    Array.from(pairs.entries()).map(async ([key, { brandId, modelId }]) => {
      indexByPair.set(key, await loadComparableIndex(brandId, modelId));
    })
  );

  const results = new Map<string, EstimateResult | null>();
  for (const listing of listings) {
    if (!listing.brandId || !listing.modelId) {
      results.set(listing.id, null);
      continue;
    }
    const index = indexByPair.get(`${listing.brandId}-${listing.modelId}`) ?? EMPTY_INDEX;
    results.set(
      listing.id,
      estimateFromIndex(index, {
        year: listing.year,
        mileage: listing.mileage ?? undefined,
        wilayaId: listing.wilayaId,
        equipmentIds: listing.equipmentIds,
        excludeListingId: listing.id,
      })
    );
  }

  return results;
}
