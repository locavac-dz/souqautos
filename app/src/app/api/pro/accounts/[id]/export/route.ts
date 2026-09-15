import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { canManageProListings } from "@/lib/pro-account";
import { parseProPermissions, type ProPermissions } from "@/lib/pro-permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import { EXPORT_CSV_HEADER, listingToCsvRow } from "@/lib/bulk-import";
import { stringifyCsv } from "@/lib/csv";
import { hasAdvancedProTools, getSubscriptionStatus } from "@/lib/pro-subscription";

// Lot 81 — inverse de l'import en masse (Lot 41) : même permission
// (gererAnnonces), mais réservé aux paliers Pro/Premium (§4-B, seul outil
// distinguant réellement les paliers au-delà du quota).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`export-listings:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const account = await prisma.professionalAccount.findUnique({ where: { id } });
  if (!account) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let permissions: ProPermissions | null = null;
  const isOwner = account.userId === user.id;
  if (!isOwner) {
    const collaborator = await prisma.proCollaborator.findUnique({
      where: { professionalAccountId_userId: { professionalAccountId: id, userId: user.id } },
    });
    permissions = collaborator ? parseProPermissions(collaborator.permissions) : null;
  }
  if (!canManageProListings({ isOwner, permissions })) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const subscriptionStatus = await getSubscriptionStatus(account.userId);
  if (!subscriptionStatus || !hasAdvancedProTools(subscriptionStatus.tier)) {
    return NextResponse.json({ error: "export_not_available" }, { status: 403 });
  }

  const listings = await prisma.listing.findMany({
    where: { sellerId: account.userId },
    orderBy: { createdAt: "desc" },
    include: { brand: { select: { name: true } }, model: { select: { name: true } }, wilaya: { select: { nomFr: true } } },
  });

  const rows = [EXPORT_CSV_HEADER, ...listings.map((listing) => listingToCsvRow(listing))];
  const csv = stringifyCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="souq-auto-stock-${id}.csv"`,
    },
  });
}
