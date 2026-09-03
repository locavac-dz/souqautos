import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkReviewEligibility, isValidRating } from "@/lib/reviews";

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!checkRateLimit(`create-review:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id: sellerId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success || !isValidRating(parsed.data.rating)) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const seller = await prisma.user.findUnique({ where: { id: sellerId } });
  if (!seller) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [interactionCount, existingReview] = await Promise.all([
    prisma.conversation.count({ where: { buyerId: user.id, sellerId } }),
    prisma.review.findUnique({
      where: { sellerId_authorId: { sellerId, authorId: user.id } },
    }),
  ]);

  const eligibility = checkReviewEligibility({
    isSelf: user.id === sellerId,
    hasInteracted: interactionCount > 0,
    alreadyReviewed: Boolean(existingReview),
  });
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 400 });
  }

  await prisma.review.create({
    data: {
      sellerId,
      authorId: user.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
