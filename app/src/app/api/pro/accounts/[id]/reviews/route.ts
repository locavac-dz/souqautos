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

  if (!checkRateLimit(`create-pro-review:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id: accountId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success || !isValidRating(parsed.data.rating)) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const account = await prisma.professionalAccount.findUnique({ where: { id: accountId } });
  if (!account) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Un collaborateur de l'entreprise ne peut pas non plus noter l'entreprise
  // pour laquelle il travaille — même logique que le propriétaire.
  const [interactionCount, existingReview, collaboration] = await Promise.all([
    prisma.conversation.count({ where: { buyerId: user.id, sellerId: account.userId } }),
    prisma.review.findUnique({
      where: { professionalAccountId_authorId: { professionalAccountId: accountId, authorId: user.id } },
    }),
    prisma.proCollaborator.findUnique({
      where: { professionalAccountId_userId: { professionalAccountId: accountId, userId: user.id } },
    }),
  ]);

  const eligibility = checkReviewEligibility({
    isSelf: user.id === account.userId || Boolean(collaboration),
    hasInteracted: interactionCount > 0,
    alreadyReviewed: Boolean(existingReview),
  });
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 400 });
  }

  await prisma.review.create({
    data: {
      professionalAccountId: accountId,
      authorId: user.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
