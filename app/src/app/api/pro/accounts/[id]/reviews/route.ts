import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkReviewEligibility, isValidRating } from "@/lib/reviews";
import { parseProPermissions } from "@/lib/pro-permissions";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`create-pro-review:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
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

  // Même écart que pour un vendeur particulier (comblé ci-dessus dans
  // /api/users/[id]/reviews) — notifie le propriétaire ET les
  // collaborateurs avec la permission repondreAvis (Lot 42/61 : ce sont eux
  // qui répondent réellement au quotidien, pas seulement le propriétaire).
  const [owner, collaborators] = await Promise.all([
    prisma.user.findUnique({ where: { id: account.userId } }),
    prisma.proCollaborator.findMany({
      where: { professionalAccountId: accountId },
      include: { user: true },
    }),
  ]);
  const recipients = [
    ...(owner ? [owner] : []),
    ...collaborators
      .filter((c) => parseProPermissions(c.permissions).repondreAvis)
      .map((c) => c.user),
  ];

  const authorName = escapeHtml(user.profile?.displayName ?? user.email);
  for (const recipient of recipients) {
    const t = await getTranslations({ locale: recipient.locale, namespace: "Notifications" });
    const emailResult = await sendEmail({
      to: recipient.email,
      subject: t("newReviewSubject"),
      html: `<p>${t("greeting")}</p><p>${t("newReviewBody", {
        name: authorName,
        rating: parsed.data.rating,
      })}</p><p><a href="${SITE_URL}/${recipient.locale}/pro/${accountId}">${t("newReviewLink")}</a></p>`,
    }).catch((err) => {
      console.error(`[EMAIL nouvel avis pro] échec envoi: ${(err as Error).message}`);
      return null;
    });
    if (emailResult?.previewUrl) {
      console.log(`[EMAIL nouvel avis pro] ${emailResult.previewUrl}`);
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
