import { prisma } from "@/lib/prisma";
import { computeAverageRating } from "@/lib/reviews";
import { accountAgeInDays, computeTrustScore, type TrustScoreBreakdown } from "@/lib/trust-score";

export type SellerTrustSummary = {
  trustBreakdown: TrustScoreBreakdown;
  averageRating: number;
  reviewCount: number;
  confirmedReportCount: number;
  accountAgeDays: number;
};

// Extrait de la page vendeur (Lot 10/12) pour être réutilisé sans duplication
// par le comparateur (Lot 5/23 — afficher le score de confiance et les avis
// sur le comparateur, jusqu'ici seuls les modules existaient sans y être reliés).
export async function getSellerTrustSummary(sellerId: string): Promise<SellerTrustSummary | null> {
  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { createdAt: true, emailVerifiedAt: true, phoneVerifiedAt: true, identityVerifiedAt: true },
  });
  if (!seller) return null;

  const [reviews, confirmedReportCount] = await Promise.all([
    prisma.review.findMany({ where: { sellerId }, select: { rating: true } }),
    prisma.report.count({ where: { status: "TRAITE", listing: { sellerId } } }),
  ]);

  const { average, count } = computeAverageRating(reviews.map((r) => r.rating));
  const accountAgeDays = accountAgeInDays(seller.createdAt);
  const trustBreakdown = computeTrustScore({
    emailVerified: Boolean(seller.emailVerifiedAt),
    phoneVerified: Boolean(seller.phoneVerifiedAt),
    identityVerified: Boolean(seller.identityVerifiedAt),
    accountAgeDays,
    reviewCount: count,
    averageRating: average,
    confirmedReportCount,
  });

  return {
    trustBreakdown,
    averageRating: average,
    reviewCount: count,
    confirmedReportCount,
    accountAgeDays,
  };
}

// Comblement du plus vieux écart encore ouvert (Lot 12) : le score de
// confiance n'était affiché que sur la page vitrine du vendeur. Version par
// lot pour les cartes de résultats (recherche, pages marque/modèle) — même
// arbitrage N+1 que estimatePricesForListings (Lot 4) : un vendeur avec
// plusieurs annonces dans la même liste ne déclenche qu'un seul calcul.
export async function getSellerTrustSummariesForSellers(
  sellerIds: string[]
): Promise<Map<string, SellerTrustSummary>> {
  const uniqueIds = [...new Set(sellerIds)];
  const entries = await Promise.all(
    uniqueIds.map(async (sellerId) => [sellerId, await getSellerTrustSummary(sellerId)] as const)
  );
  return new Map(
    entries.filter((entry): entry is [string, SellerTrustSummary] => entry[1] !== null)
  );
}
