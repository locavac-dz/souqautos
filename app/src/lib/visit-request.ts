import type { ListingStatus, VisitRequestStatus } from "@prisma/client";

const MIN_HOURS_AHEAD = 4;
const MAX_DAYS_AHEAD = 60;
const MAX_PENDING_PER_BUYER_PER_LISTING = 1;
const MAX_PENDING_PER_BUYER = 10;

export type VisitRequestError =
  | "self_visit"
  | "listing_not_published"
  | "too_soon"
  | "too_far"
  | "already_pending"
  | "too_many_pending";

export function checkProposedDate(
  proposedAt: Date,
  now: Date = new Date()
): VisitRequestError | null {
  const diffMs = proposedAt.getTime() - now.getTime();
  if (diffMs < MIN_HOURS_AHEAD * 60 * 60 * 1000) return "too_soon";
  if (diffMs > MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) return "too_far";
  return null;
}

export function checkCanRequestVisit(
  buyerId: string,
  sellerId: string,
  listingStatus: ListingStatus,
  pendingForThisListing: number,
  totalPendingByBuyer: number
): VisitRequestError | null {
  if (buyerId === sellerId) return "self_visit";
  if (listingStatus !== "PUBLIEE") return "listing_not_published";
  if (pendingForThisListing >= MAX_PENDING_PER_BUYER_PER_LISTING) return "already_pending";
  if (totalPendingByBuyer >= MAX_PENDING_PER_BUYER) return "too_many_pending";
  return null;
}

const RESPONDABLE: VisitRequestStatus[] = ["EN_ATTENTE"];

export function checkCanRespond(status: VisitRequestStatus): boolean {
  return RESPONDABLE.includes(status);
}

const CANCELLABLE: VisitRequestStatus[] = ["EN_ATTENTE", "CONFIRMEE"];

export function checkCanCancel(status: VisitRequestStatus): boolean {
  return CANCELLABLE.includes(status);
}

export { MIN_HOURS_AHEAD, MAX_DAYS_AHEAD, MAX_PENDING_PER_BUYER_PER_LISTING, MAX_PENDING_PER_BUYER };
