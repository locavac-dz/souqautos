import type { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PROSPECT_STATUS,
  countByStatus,
  isAwaitingReply,
  sortProspects,
  type ProspectStatusValue,
} from "@/lib/prospects";

// Lot 123 — lit en base les prospects (conversations) d'un compte professionnel.

// Au plus ce nombre de conversations sont lues : au-delà, les plus anciennes ne sont pas listées
// (elles restent dans la messagerie). Largement au-dessus des volumes attendus.
export const MAX_PROSPECTS_LOADED = 500;

export type ProspectRow = {
  conversationId: string;
  buyerId: string;
  buyerName: string | null;
  listing: { id: string; title: string; status: ListingStatus };
  status: ProspectStatusValue;
  note: string | null;
  awaitingReply: boolean;
  lastActivityAt: Date;
  createdAt: Date;
};

export type ProspectsReport = {
  rows: ProspectRow[]; // après filtres, triées
  counts: Record<ProspectStatusValue, number>; // sur tous les prospects de l'annonce filtrée, avant filtre de statut
  listings: { id: string; title: string }[]; // annonces qui ont au moins un prospect, pour le filtre
  total: number;
  truncated: boolean;
};

// `sellerId` est le propriétaire du compte pro : c'est lui qui porte les annonces et les
// conversations, même quand c'est un collaborateur qui consulte.
export async function loadProspects(
  sellerId: string,
  filters: { listingId?: string | null; status?: ProspectStatusValue | null } = {}
): Promise<ProspectsReport> {
  const conversations = await prisma.conversation.findMany({
    // Comme la messagerie : une conversation que le vendeur a masquée ne revient pas ici.
    where: { sellerId, hiddenBySellerAt: null },
    orderBy: { createdAt: "desc" },
    take: MAX_PROSPECTS_LOADED + 1,
    select: {
      id: true,
      buyerId: true,
      createdAt: true,
      listing: { select: { id: true, title: true, status: true } },
      buyer: { select: { profile: { select: { displayName: true } } } },
      prospectFollowUp: { select: { status: true, note: true } },
      messages: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1, select: { senderId: true, createdAt: true } },
    },
  });

  const truncated = conversations.length > MAX_PROSPECTS_LOADED;
  const all: ProspectRow[] = conversations.slice(0, MAX_PROSPECTS_LOADED).map((c) => {
    const last = c.messages[0] ?? null;
    return {
      conversationId: c.id,
      buyerId: c.buyerId,
      buyerName: c.buyer.profile?.displayName ?? null,
      listing: c.listing,
      status: c.prospectFollowUp?.status ?? DEFAULT_PROSPECT_STATUS,
      note: c.prospectFollowUp?.note ?? null,
      awaitingReply: isAwaitingReply(last, c.buyerId),
      lastActivityAt: last?.createdAt ?? c.createdAt,
      createdAt: c.createdAt,
    };
  });

  const listingsWithProspects = new Map(all.map((r) => [r.listing.id, r.listing.title]));
  const forListing = filters.listingId ? all.filter((r) => r.listing.id === filters.listingId) : all;
  const filtered = filters.status ? forListing.filter((r) => r.status === filters.status) : forListing;

  return {
    rows: sortProspects(filtered),
    counts: countByStatus(forListing),
    listings: [...listingsWithProspects].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title)),
    total: all.length,
    truncated,
  };
}
