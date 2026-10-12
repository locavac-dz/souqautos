import type { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildDailySeries,
  windowDayKeys,
  windowStart,
  type DayPoint,
} from "@/lib/pro-stats";
import { computePriceBadge, type PriceBadge } from "@/lib/price-badge";

const STATS_LISTING_STATUSES: ListingStatus[] = ["PUBLIEE", "VENDUE", "EXPIREE", "SUSPENDUE"];

export type ListingMiniStats = {
  listingId: string;
  title: string;
  status: ListingStatus;
  price: number;
  views: number;
  favorites: number;
  offers: number;
  priceBadge: { badge: PriceBadge; deviationPct: number } | null;
};

export type SellerStatsReport = {
  totalViews: number;
  totalFavorites: number;
  totalOffers: number;
  activeListings: number;
  viewsSeries: DayPoint[];
  listings: ListingMiniStats[];
};

export async function loadSellerStats(
  sellerId: string,
  days: number,
  now: Date = new Date()
): Promise<SellerStatsReport> {
  const keys = windowDayKeys(days, now);
  const since = windowStart(days, now);
  const firstDay = new Date(`${keys[0]}T00:00:00.000Z`);

  const listings = await prisma.listing.findMany({
    where: { sellerId, status: { in: STATS_LISTING_STATUSES } },
    select: {
      id: true,
      title: true,
      status: true,
      price: true,
      priceAiLow: true,
      priceAiHigh: true,
    },
  });
  const ids = listings.map((l) => l.id);
  if (ids.length === 0) {
    return {
      totalViews: 0,
      totalFavorites: 0,
      totalOffers: 0,
      activeListings: 0,
      viewsSeries: buildDailySeries(keys, new Map()),
      listings: [],
    };
  }

  const [viewsByListing, viewsByDay, favoritesByListing, offersByListing] =
    await Promise.all([
      prisma.listingViewDay.groupBy({
        by: ["listingId"],
        where: { listingId: { in: ids }, day: { gte: firstDay } },
        _sum: { count: true },
      }),
      prisma.listingViewDay.groupBy({
        by: ["day"],
        where: { listingId: { in: ids }, day: { gte: firstDay } },
        _sum: { count: true },
      }),
      prisma.favorite.groupBy({
        by: ["listingId"],
        where: { listingId: { in: ids }, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.offer.groupBy({
        by: ["listingId"],
        where: { sellerId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);

  const viewsMap = new Map(viewsByListing.map((r) => [r.listingId, r._sum.count ?? 0]));
  const favsMap = new Map(favoritesByListing.map((r) => [r.listingId, r._count._all]));
  const offersMap = new Map(offersByListing.map((r) => [r.listingId, r._count._all]));

  const rows: ListingMiniStats[] = listings.map((l) => {
    const mid = l.priceAiLow != null && l.priceAiHigh != null
      ? Math.round((l.priceAiLow + l.priceAiHigh) / 2)
      : 0;
    const sampleSize = mid > 0 ? 3 : 0;
    return {
      listingId: l.id,
      title: l.title,
      status: l.status,
      price: l.price,
      views: viewsMap.get(l.id) ?? 0,
      favorites: favsMap.get(l.id) ?? 0,
      offers: offersMap.get(l.id) ?? 0,
      priceBadge: mid > 0 ? computePriceBadge(l.price, mid, sampleSize) : null,
    };
  });

  rows.sort((a, b) => b.views - a.views || b.favorites - a.favorites || a.listingId.localeCompare(b.listingId));

  const viewsCounts = new Map(viewsByDay.map((r) => [r.day.toISOString().slice(0, 10), r._sum.count ?? 0]));

  return {
    totalViews: rows.reduce((s, r) => s + r.views, 0),
    totalFavorites: rows.reduce((s, r) => s + r.favorites, 0),
    totalOffers: rows.reduce((s, r) => s + r.offers, 0),
    activeListings: listings.filter((l) => l.status === "PUBLIEE").length,
    viewsSeries: buildDailySeries(keys, viewsCounts),
    listings: rows,
  };
}
