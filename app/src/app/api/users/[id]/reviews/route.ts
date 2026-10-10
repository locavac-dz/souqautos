import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody, requireUser } from "@/lib/api-route";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { checkReviewEligibility, isValidRating } from "@/lib/reviews";
import { sendEmailBestEffort, escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`create-review:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id: sellerId } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;
  if (!isValidRating(body.rating)) {
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

  // Lot 167 — auto-approbation : si l'auteur a déjà un avis APPROVED, le nouvel
  // avis est publié directement (expérience connue), sinon il part en PENDING.
  const priorApproved = await prisma.review.count({
    where: { authorId: user.id, status: "APPROVED" },
  });
  const status = priorApproved > 0 ? "APPROVED" : "PENDING";

  try {
    await prisma.review.create({
      data: {
        sellerId,
        authorId: user.id,
        rating: body.rating,
        comment: body.comment?.trim() || null,
        status,
      },
    });
  } catch (error) {
    // Deux avis simultanés du même auteur : un seul est retenu, et le vendeur
    // n'est pas notifié deux fois.
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "already_reviewed" }, { status: 409 });
    }
    throw error;
  }

  // Écart documenté depuis le Lot 27 (comme la notification de réponse
  // elle-même, comblée ensuite) : le vendeur n'était jamais informé qu'il
  // avait reçu un nouvel avis, donc jamais incité à y répondre.
  const t = await getTranslations({ locale: seller.locale, namespace: "Notifications" });
  const authorName = escapeHtml(user.profile?.displayName ?? user.email);
  await sendEmailBestEffort("nouvel avis", {
    to: seller.email,
    subject: t("newReviewSubject"),
    html: `<p>${t("greeting")}</p><p>${t("newReviewBody", {
      name: authorName,
      rating: body.rating,
    })}</p><p><a href="${SITE_URL}/${seller.locale}/vendeur/${sellerId}">${t("newReviewLink")}</a></p>`,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
