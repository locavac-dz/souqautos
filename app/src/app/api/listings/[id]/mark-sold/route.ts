import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkListingCanBeMarkedSold } from "@/lib/listing-lifecycle";
import { canManageListing } from "@/lib/listing-access";
import { cancelPendingOrdersForListing } from "@/lib/payment-fulfillment";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`mark-sold-listing:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!(await canManageListing(user.id, listing.sellerId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const eligibility = checkListingCanBeMarkedSold(listing.status);
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 400 });
  }

  // Lot 265 — une annonce vendue n'a plus de formule à activer : ses commandes EN_ATTENTE sont annulées
  // dans la même transaction, pour qu'un paiement qui arriverait ensuite ne la republie pas.
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.listing.update({ where: { id }, data: { status: "VENDUE" } });
    await cancelPendingOrdersForListing(tx, id, "listing_vendue", now);
  });

  return NextResponse.json({ status: "VENDUE" });
}
