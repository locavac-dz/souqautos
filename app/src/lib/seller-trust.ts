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

type SellerVerificationFlags = {
  createdAt: Date;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  identityVerifiedAt: Date | null;
};

// Calcul pur, partagé par getSellerTrustSummary (un vendeur) et
// getSellerTrustSummariesForSellers (plusieurs vendeurs, requêtes batchées) —
// jamais deux copies du même calcul à faire évoluer séparément (Lot 99,
// audit qualité).
function buildSellerTrustSummary(
  seller: SellerVerificationFlags,
  ratings: number[],
  confirmedReportCount: number
): SellerTrustSummary {
  const { average, count } = computeAverageRating(ratings);
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

  return buildSellerTrustSummary(
    seller,
    reviews.map((r) => r.rating),
    confirmedReportCount
  );
}

// Comblement du plus vieux écart encore ouvert (Lot 12) : le score de
// confiance n'était affiché que sur la page vitrine du vendeur. Version par
// lot pour les cartes de résultats (recherche, pages marque/modèle) — même
// arbitrage N+1 que estimatePricesForListings (Lot 4) : un vendeur avec
// plusieurs annonces dans la même liste ne déclenche qu'un seul calcul.
//
// 3 requêtes batchées (une par table) plutôt que 3×N (Lot 99, audit
// qualité) — même technique que getProfessionalBadgesForSellers
// (src/lib/professional-accounts.ts) : un `findMany({ in: uniqueIds })` par
// table, puis regroupement en mémoire, jamais un round-trip par vendeur.
// `Report` n'a pas de colonne `sellerId` directe (relation via `listing`),
// d'où le `findMany` + regroupement au lieu d'un `groupBy`.
export async function getSellerTrustSummariesForSellers(
  sellerIds: string[]
): Promise<Map<string, SellerTrustSummary>> {
  const uniqueIds = [...new Set(sellerIds)];
  if (uniqueIds.length === 0) return new Map();

  const [sellers, reviews, confirmedReports] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, createdAt: true, emailVerifiedAt: true, phoneVerifiedAt: true, identityVerifiedAt: true },
    }),
    prisma.review.findMany({
      where: { sellerId: { in: uniqueIds } },
      select: { sellerId: true, rating: true },
    }),
    prisma.report.findMany({
      where: { status: "TRAITE", listing: { sellerId: { in: uniqueIds } } },
      select: { listing: { select: { sellerId: true } } },
    }),
  ]);

  const ratingsBySeller = new Map<string, number[]>();
  for (const review of reviews) {
    // sellerId est nullable au niveau du schéma (un avis peut aussi porter
    // sur un compte professionnel, cf. professionalAccountId) mais ne peut
    // pas l'être ici : la requête ci-dessus filtre déjà sur sellerId in
    // uniqueIds, Prisma ne rétrécit simplement pas le type en fonction du where.
    if (!review.sellerId) continue;
    const list = ratingsBySeller.get(review.sellerId) ?? [];
    list.push(review.rating);
    ratingsBySeller.set(review.sellerId, list);
  }

  const reportCountBySeller = new Map<string, number>();
  for (const report of confirmedReports) {
    const sellerId = report.listing?.sellerId;
    if (!sellerId) continue;
    reportCountBySeller.set(sellerId, (reportCountBySeller.get(sellerId) ?? 0) + 1);
  }

  const summaries = new Map<string, SellerTrustSummary>();
  for (const seller of sellers) {
    summaries.set(
      seller.id,
      buildSellerTrustSummary(
        seller,
        ratingsBySeller.get(seller.id) ?? [],
        reportCountBySeller.get(seller.id) ?? 0
      )
    );
  }

  return summaries;
}
