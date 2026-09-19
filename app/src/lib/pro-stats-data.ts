import type { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildDailySeries,
  countByDay,
  sortListingStats,
  sumStats,
  windowDayKeys,
  windowStart,
  type DayPoint,
  type ListingStats,
} from "@/lib/pro-stats";

// Lot 122 — lit en base les statistiques d'un compte professionnel sur une période.

// Annonces qui ont pu être vues : jamais les brouillons, ni celles refusées ou en attente de modération.
const STATS_LISTING_STATUSES: ListingStatus[] = ["PUBLIEE", "VENDUE", "EXPIREE", "SUSPENDUE"];

export type ListingStatsRow = ListingStats & { title: string; status: ListingStatus; price: number };

export type ProStatsReport = {
  totals: Omit<ListingStats, "listingId">;
  viewsSeries: DayPoint[];
  contactsSeries: DayPoint[];
  listings: ListingStatsRow[];
};

// `sellerId` est l'identifiant du propriétaire du compte pro : c'est lui qui porte les annonces,
// les conversations et les contacts (les collaborateurs n'en ont jamais en propre).
export async function loadProStats(sellerId: string, days: number, now: Date = new Date()): Promise<ProStatsReport> {
  const keys = windowDayKeys(days, now);
  const since = windowStart(days, now);
  const firstDay = new Date(`${keys[0]}T00:00:00.000Z`); // colonne DATE : minuit UTC de la date civile

  const listings = await prisma.listing.findMany({
    where: { sellerId, status: { in: STATS_LISTING_STATUSES } },
    select: { id: true, title: true, status: true, price: true },
  });
  const ids = listings.map((l) => l.id);
  if (ids.length === 0) {
    return { totals: sumStats([]), viewsSeries: buildDailySeries(keys, new Map()), contactsSeries: buildDailySeries(keys, new Map()), listings: [] };
  }

  const [viewsByListing, viewsByDay, contacts, favorites, conversations] = await Promise.all([
    prisma.listingViewDay.groupBy({ by: ["listingId"], where: { listingId: { in: ids }, day: { gte: firstDay } }, _sum: { count: true } }),
    prisma.listingViewDay.groupBy({ by: ["day"], where: { listingId: { in: ids }, day: { gte: firstDay } }, _sum: { count: true } }),
    prisma.contactEvent.findMany({ where: { listingId: { in: ids }, createdAt: { gte: since } }, select: { listingId: true, channel: true, createdAt: true } }),
    prisma.favorite.groupBy({ by: ["listingId"], where: { listingId: { in: ids }, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.conversation.findMany({ where: { listingId: { in: ids }, createdAt: { gte: since } }, select: { listingId: true, createdAt: true } }),
  ]);

  const perListing = new Map<string, ListingStats>(
    ids.map((id) => [id, { listingId: id, views: 0, favorites: 0, phoneReveals: 0, whatsappOpens: 0, conversations: 0 }])
  );
  for (const row of viewsByListing) perListing.get(row.listingId)!.views = row._sum.count ?? 0;
  for (const row of favorites) perListing.get(row.listingId)!.favorites = row._count._all;
  for (const event of contacts) {
    const stats = perListing.get(event.listingId)!;
    if (event.channel === "TELEPHONE") stats.phoneReveals += 1;
    else stats.whatsappOpens += 1;
  }
  for (const conversation of conversations) perListing.get(conversation.listingId)!.conversations += 1;

  const viewsCounts = new Map(viewsByDay.map((row) => [row.day.toISOString().slice(0, 10), row._sum.count ?? 0]));
  const contactsCounts = countByDay([...contacts.map((c) => c.createdAt), ...conversations.map((c) => c.createdAt)]);

  const details = new Map(listings.map((l) => [l.id, l]));
  const rows = sortListingStats([...perListing.values()]).map((stats) => {
    const listing = details.get(stats.listingId)!;
    return { ...stats, title: listing.title, status: listing.status, price: listing.price };
  });

  return {
    totals: sumStats(rows),
    viewsSeries: buildDailySeries(keys, viewsCounts),
    contactsSeries: buildDailySeries(keys, contactsCounts),
    listings: rows,
  };
}
