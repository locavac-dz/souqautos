import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { MAX_COMPARE } from "@/lib/compare";
import { getSellerTrustSummary } from "@/lib/seller-trust";
import { generateCompareSummary } from "@/lib/ai-compare";

const bodySchema = z.object({
  ids: z.array(z.string()).min(2).max(MAX_COMPARE),
  locale: z.enum(["fr", "ar"]).default("fr"),
});

// Un appel IA a un coût réel dès qu'une clé Anthropic est configurée (même si
// aucun coût n'est engagé aujourd'hui, repli heuristique sans clé, cf.
// src/lib/ai-compare.ts) — limite resserrée comme pour la suggestion de
// rédaction (Lot 57).
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`compare-summary:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  // Jamais les faits fournis par le client — toujours relus depuis la base,
  // même discipline que GET /api/listings/compare (une annonce non PUBLIEE ou
  // un id fabriqué ne doit jamais entrer dans le résumé).
  const listings = await prisma.listing.findMany({
    where: { id: { in: parsed.data.ids }, status: "PUBLIEE" },
    select: { id: true, title: true, price: true, mileage: true, year: true, powerHp: true, sellerId: true },
  });

  if (listings.length < 2) {
    return NextResponse.json({ error: "not_enough_listings" }, { status: 400 });
  }

  const uniqueSellerIds = [...new Set(listings.map((l) => l.sellerId))];
  const trustBySeller = new Map(
    await Promise.all(
      uniqueSellerIds.map(async (sellerId) => [sellerId, await getSellerTrustSummary(sellerId)] as const)
    )
  );

  const facts = listings.map((l) => ({
    id: l.id,
    title: l.title,
    price: l.price,
    mileage: l.mileage,
    year: l.year,
    powerHp: l.powerHp,
    trustScore: trustBySeller.get(l.sellerId)?.trustBreakdown.score ?? null,
  }));

  const summary = await generateCompareSummary(facts, parsed.data.locale);

  return NextResponse.json(summary);
}
