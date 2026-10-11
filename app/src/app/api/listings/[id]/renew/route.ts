import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkListingRenewable, computeExpiryDate } from "@/lib/listing-lifecycle";
import { canManageListing } from "@/lib/listing-access";

export const POST = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`renew-listing:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
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

  const eligibility = checkListingRenewable(listing.status);
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 400 });
  }

  const now = new Date();
  const newExpiresAt = computeExpiryDate(now);
  await prisma.listing.update({
    where: { id },
    data: {
      status: "PUBLIEE",
      expiresAt: newExpiresAt,
      publishedAt: now,
      // Nouveau cycle d'expiration (Lot 48) : le rappel doit pouvoir repartir.
      expiryReminderSentAt: null,
      // Historique des renouvellements (Lot 49).
      renewals: { create: [{ renewedAt: now, expiresAt: newExpiresAt }] },
    },
  });

  return NextResponse.json({ status: "PUBLIEE" });
});
