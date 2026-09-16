import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { estimateFromRows, type EstimateResult } from "@/lib/price-estimation";

// Lots 77-78, 84 — "Système anti-fraude" documenté depuis le Lot 0
// (docs/ARCHITECTURE.md §16 : "Règles + IA : détection de prix anormalement
// bas, photos dupliquées inter-annonces, comptes/comportements suspects,
// incohérences véhicule/prix, spam") mais jamais construit jusqu'ici — seul
// le circuit réactif de signalement par les utilisateurs existait (Lot 21).
// Ici : des règles simples, jamais une "IA" fabriquée sans base réelle.
// Ces signaux sont uniquement des AIDES à la décision du modérateur humain —
// jamais un rejet ou une accusation automatique (§16 : "bandeau d'avertissement
// non accusatoire").

export type FraudSignals = {
  duplicatePhoto: boolean;
  lowPrice: boolean;
  sellerRejectionHistory: boolean;
  duplicateContent: boolean;
  vehicleInconsistency: boolean;
};

// Lot 84 — "spam" (§16 : "répétition de contenu ... pour un même vendeur") :
// empreinte du titre+description normalisés (espaces/casse ignorés), jamais
// une comparaison floue — un texte reformulé même légèrement n'est pas
// détecté, c'est une limite assumée (comme pour les photos, Lot 77).
export function computeListingContentHash(title: string, description: string): string {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(`${normalize(title)}\n${normalize(description)}`).digest("hex");
}

// Un contenu strictement identique (titre+description) publié par un AUTRE
// vendeur est un indice classique de spam/annonce-appât recopiée sous
// plusieurs comptes — un vendeur qui republie SON PROPRE texte (renouvellement,
// annonce similaire pour un véhicule identique) n'est jamais signalé.
export function detectDuplicateContent(
  ownSellerId: string,
  ownHash: string,
  otherListings: { contentHash: string; sellerId: string }[]
): boolean {
  if (ownHash === "") return false;
  return otherListings.some((l) => l.sellerId !== ownSellerId && l.contentHash === ownHash);
}

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

// "Comportements suspects" (§16) : un vendeur dont plusieurs AUTRES annonces
// ont déjà été refusées ou suspendues par un modérateur humain n'est pas
// automatiquement de mauvaise foi (un refus isolé arrive à tout le monde),
// mais un historique répété mérite une vérification plus attentive de la
// nouvelle annonce — jamais une seule annonce refusée (trop courant pour être
// un signal), un seuil de 2 évite de pénaliser une erreur ponctuelle corrigée.
export const MIN_REJECTIONS_FOR_SIGNAL = 2;

export function detectSellerRejectionHistory(rejectionCount: number): boolean {
  return rejectionCount >= MIN_REJECTIONS_FOR_SIGNAL;
}

// Lot 93 — "incohérence véhicule/prix" (§16), dernier des cinq signaux visés
// par le cahier des charges, resté non construit depuis le Lot 84 faute de
// définition qui ne duplique pas le signal "prix bas" (lowPrice ci-dessus,
// qui compare le prix aux VRAIES annonces comparables — inopérant sous les
// 3 comparables, cf. MIN_SAMPLE_SIZE_FOR_LOW_PRICE_SIGNAL, un vrai trou de
// couverture pour les marques/modèles rares). Signal volontairement
// indépendant de tout prix ou comparable : une incohérence interne entre
// deux champs DÉCLARÉS PAR LE VENDEUR lui-même sur CETTE annonce (état
// "Neuf" vs kilométrage/année), jamais une estimation de marché — donc
// jamais un seuil fabriqué à partir de données de prix qui n'existent pas.
// Seuils volontairement conservateurs (cf. Lot 86, photo quality) : ne vise
// que des cas extrêmes et sans ambiguïté, jamais une annonce légitime
// (véhicule neuf convoyé/essayé sur quelques centaines de km).
export const NEUF_MAX_PLAUSIBLE_MILEAGE_KM = 500;
export const NEUF_MAX_AGE_YEARS = 2;

export function detectVehicleInconsistency(
  condition: "NEUF" | "OCCASION",
  mileage: number,
  year: number,
  currentYear: number
): boolean {
  if (condition !== "NEUF") return false;
  if (mileage > NEUF_MAX_PLAUSIBLE_MILEAGE_KM) return true;
  if (currentYear - year > NEUF_MAX_AGE_YEARS) return true;
  return false;
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
  condition: "NEUF" | "OCCASION";
  contentHash: string;
  photos: { sha256: string }[];
};

// Version batch pour la file de modération : une seule requête pour toutes les
// photos existantes potentiellement concernées, une seule requête par couple
// marque/modèle DISTINCT pour l'estimation — même principe que
// estimatePricesForListings (Lot 4/72), jamais une requête par annonce.
export async function getFraudSignalsForListings(
  listings: ListingForFraudSignals[]
): Promise<Map<string, FraudSignals>> {
  const currentYear = new Date().getFullYear();

  // Ces 4 requêtes ne dépendent que de `listings` (jamais du résultat d'une
  // autre) — lancées ensemble via Promise.all plutôt que séquentiellement,
  // un seul aller-retour réseau de plus que la plus lente d'entre elles au
  // lieu de la somme des quatre (Lot 97).
  const allHashes = Array.from(
    new Set(listings.flatMap((l) => l.photos.map((p) => p.sha256)).filter((h) => h !== ""))
  );
  const allContentHashes = Array.from(new Set(listings.map((l) => l.contentHash).filter((h) => h !== "")));
  const pairs = new Map<string, { brandId: number; modelId: number }>();
  for (const listing of listings) {
    if (listing.brandId && listing.modelId) {
      pairs.set(`${listing.brandId}-${listing.modelId}`, { brandId: listing.brandId, modelId: listing.modelId });
    }
  }
  const sellerIds = Array.from(new Set(listings.map((l) => l.sellerId)));

  const [matchingPhotos, matchingContent, rowsByPairEntries, rejectionGroups] = await Promise.all([
    allHashes.length === 0
      ? Promise.resolve([])
      : prisma.listingPhoto.findMany({
          where: { sha256: { in: allHashes } },
          select: { sha256: true, listing: { select: { sellerId: true } } },
        }),
    allContentHashes.length === 0
      ? Promise.resolve([])
      : prisma.listing.findMany({
          where: { contentHash: { in: allContentHashes } },
          select: { contentHash: true, sellerId: true },
        }),
    Promise.all(
      Array.from(pairs.entries()).map(
        async ([key, { brandId, modelId }]) => [key, await loadComparableRows(brandId, modelId)] as const
      )
    ),
    sellerIds.length === 0
      ? Promise.resolve([])
      : prisma.listing.groupBy({
          by: ["sellerId"],
          where: { sellerId: { in: sellerIds }, status: { in: ["REFUSEE", "SUSPENDUE"] } },
          _count: { _all: true },
        }),
  ]);

  const otherPhotos = matchingPhotos.map((p) => ({ sha256: p.sha256, sellerId: p.listing.sellerId }));
  const rowsByPair = new Map(rowsByPairEntries);
  const rejectionCountBySeller = new Map(rejectionGroups.map((g) => [g.sellerId, g._count._all]));

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

    const sellerRejectionHistory = detectSellerRejectionHistory(rejectionCountBySeller.get(listing.sellerId) ?? 0);

    const duplicateContent = detectDuplicateContent(listing.sellerId, listing.contentHash, matchingContent);

    const vehicleInconsistency = detectVehicleInconsistency(
      listing.condition,
      listing.mileage,
      listing.year,
      currentYear
    );

    results.set(listing.id, {
      duplicatePhoto,
      lowPrice,
      sellerRejectionHistory,
      duplicateContent,
      vehicleInconsistency,
    });
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
