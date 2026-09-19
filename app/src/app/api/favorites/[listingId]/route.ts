import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { isUniqueViolation } from "@/lib/prisma-errors";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ listingId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`favorite:${user.id}`, { limit: 60, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { listingId } = await params;
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== "PUBLIEE") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await prisma.favorite.upsert({
      where: { userId_listingId: { userId: user.id, listingId } },
      create: { userId: user.id, listingId },
      update: {},
    });
  } catch (error) {
    // Deux requêtes simultanées (double clic) : l'une a déjà créé le favori, ce
    // qui est exactement le résultat demandé. `upsert` sur une clé composée
    // n'est pas atomique côté base.
    if (!isUniqueViolation(error)) throw error;
  }

  return NextResponse.json({ favorited: true }, { status: 201 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ listingId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { listingId } = await params;
  await prisma.favorite.deleteMany({ where: { userId: user.id, listingId } });

  return NextResponse.json({ favorited: false });
}
