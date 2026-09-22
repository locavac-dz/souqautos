// Lot 150 — agrégation des notes vendeurs pour les cartes d'annonce

import { prisma } from "@/lib/prisma";

export type SellerRating = { average: number; count: number };

export async function getSellerRatingsForSellers(sellerIds: string[]): Promise<Map<string, SellerRating>> {
  if (sellerIds.length === 0) return new Map();

  const unique = [...new Set(sellerIds.filter(Boolean))];
  const rows = await prisma.review.groupBy({
    by: ["sellerId"],
    where: { sellerId: { in: unique } },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return new Map(
    rows
      .filter((r) => r.sellerId !== null && r._avg.rating !== null)
      .map((r) => [
        r.sellerId!,
        {
          average: Math.round((r._avg.rating ?? 0) * 10) / 10,
          count: r._count.rating,
        },
      ])
  );
}
