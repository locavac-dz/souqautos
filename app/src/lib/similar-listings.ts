// Lot 152 — annonces similaires : même modèle en priorité, puis même marque + fourchette de prix

import { prisma } from "@/lib/prisma";
import { listingCardInclude, type ListingWithCardRelations } from "@/lib/search";

const LIMIT = 6;
const PRICE_BAND = 0.3; // ±30 %

export async function getSimilarListings({
  excludeId,
  brandId,
  modelId,
  price,
}: {
  excludeId: string;
  brandId: number | null;
  modelId: number | null;
  price: number;
}): Promise<ListingWithCardRelations[]> {
  if (!brandId) return [];

  // Priorité 1 : même marque + même modèle
  if (modelId) {
    const byModel = await prisma.listing.findMany({
      where: { status: "PUBLIEE", brandId, modelId, id: { not: excludeId } },
      orderBy: { publishedAt: "desc" },
      take: LIMIT,
      include: listingCardInclude,
    });
    if (byModel.length >= 3) return byModel;

    // Complète avec même marque + fourchette de prix si pas assez de résultats
    const existingIds = new Set(byModel.map((l) => l.id));
    existingIds.add(excludeId);
    const byBrand = await prisma.listing.findMany({
      where: {
        status: "PUBLIEE",
        brandId,
        modelId: { not: modelId },
        id: { notIn: [...existingIds] },
        price: { gte: Math.round(price * (1 - PRICE_BAND)), lte: Math.round(price * (1 + PRICE_BAND)) },
      },
      orderBy: { publishedAt: "desc" },
      take: LIMIT - byModel.length,
      include: listingCardInclude,
    });
    return [...byModel, ...byBrand];
  }

  // Fallback : même marque + fourchette de prix
  return prisma.listing.findMany({
    where: {
      status: "PUBLIEE",
      brandId,
      id: { not: excludeId },
      price: { gte: Math.round(price * (1 - PRICE_BAND)), lte: Math.round(price * (1 + PRICE_BAND)) },
    },
    orderBy: { publishedAt: "desc" },
    take: LIMIT,
    include: listingCardInclude,
  });
}
