import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MAX_COMPARE } from "@/lib/compare";
import { getSellerTrustSummary } from "@/lib/seller-trust";

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPARE);

  if (ids.length === 0) {
    return NextResponse.json({ listings: [] });
  }

  const listings = await prisma.listing.findMany({
    where: { id: { in: ids }, status: "PUBLIEE" },
    include: {
      brand: true,
      model: true,
      wilaya: true,
      photos: { orderBy: { position: "asc" }, take: 1 },
      seller: { include: { profile: true } },
    },
  });

  // Comblement du second écart du Lot 5 (score de confiance et avis absents
  // du comparateur) — un même vendeur ne recalcule son résumé qu'une fois même
  // s'il apparaît sur plusieurs annonces comparées.
  const uniqueSellerIds = [...new Set(listings.map((l) => l.sellerId))];
  const trustBySeller = new Map(
    await Promise.all(
      uniqueSellerIds.map(async (sellerId) => [sellerId, await getSellerTrustSummary(sellerId)] as const)
    )
  );

  const withTrust = listings.map((listing) => ({
    ...listing,
    sellerTrust: trustBySeller.get(listing.sellerId) ?? null,
  }));

  // Conserve l'ordre de sélection choisi par l'utilisateur plutôt que l'ordre BDD.
  const ordered = ids
    .map((id) => withTrust.find((l) => l.id === id))
    .filter((l): l is (typeof withTrust)[number] => Boolean(l));

  return NextResponse.json({ listings: ordered });
}
