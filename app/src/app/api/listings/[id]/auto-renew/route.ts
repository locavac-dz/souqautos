import { NextRequest, NextResponse } from "next/server";
import { requireUser, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canManageListing } from "@/lib/listing-access";
import { checkListingRenewable } from "@/lib/listing-lifecycle";
import { checkRateLimit } from "@/lib/rate-limit";
import { hasAdvancedProTools, getSubscriptionStatus } from "@/lib/pro-subscription";

const bodySchema = z.object({ autoRenew: z.boolean() });

// Lot 82 — activer le renouvellement automatique exige le palier Pro/Premium
// au moment de l'activation ; le désactiver reste toujours possible, y
// compris pour un compte déjà rétrogradé (jamais bloquer un vendeur qui veut
// reprendre la main sur ses propres annonces).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`auto-renew-toggle:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!(await canManageListing(user.id, listing.sellerId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!checkListingRenewable(listing.status).ok) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  if (body.autoRenew) {
    const subscriptionStatus = await getSubscriptionStatus(listing.sellerId);
    if (!subscriptionStatus || !hasAdvancedProTools(subscriptionStatus.tier)) {
      return NextResponse.json({ error: "advanced_tools_not_available" }, { status: 403 });
    }
  }

  await prisma.listing.update({ where: { id }, data: { autoRenew: body.autoRenew } });

  return NextResponse.json({ autoRenew: body.autoRenew });
}
