import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateReviewReply } from "@/lib/reviews";
import { canReplyToProReviews } from "@/lib/pro-account";
import { parseProPermissions } from "@/lib/pro-permissions";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";

const bodySchema = z.object({ reply: z.string() });

async function checkCanReply(
  userId: string,
  review: { sellerId: string | null; professionalAccountId: string | null }
): Promise<boolean> {
  if (review.sellerId) {
    return review.sellerId === userId;
  }
  if (review.professionalAccountId) {
    const account = await prisma.professionalAccount.findUnique({
      where: { id: review.professionalAccountId },
    });
    if (!account) return false;
    if (account.userId === userId) return true;
    const collaboration = await prisma.proCollaborator.findUnique({
      where: {
        professionalAccountId_userId: { professionalAccountId: review.professionalAccountId, userId },
      },
    });
    return canReplyToProReviews({
      isOwner: false,
      permissions: collaboration ? parseProPermissions(collaboration.permissions) : null,
    });
  }
  return false;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!checkRateLimit(`reply-review:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const validation = validateReviewReply(parsed.data.reply);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const review = await prisma.review.findUnique({
    where: { id },
    include: {
      author: true,
      seller: { include: { profile: true } },
      professionalAccount: true,
    },
  });
  if (!review) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const allowed = await checkCanReply(user.id, review);
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const replyText = parsed.data.reply.trim();
  await prisma.review.update({
    where: { id },
    data: { reply: replyText, repliedAt: new Date() },
  });

  // Comblement de l'écart documenté depuis le Lot 27 : l'auteur de l'avis
  // n'était jamais informé qu'une réponse avait été publiée.
  const responderName = review.seller
    ? review.seller.profile?.displayName ?? review.seller.email
    : (review.professionalAccount?.nomCommercial ?? "");
  const targetLink = review.sellerId
    ? `${SITE_URL}/${review.author.locale}/vendeur/${review.sellerId}`
    : `${SITE_URL}/${review.author.locale}/pro/${review.professionalAccountId}`;

  const t = await getTranslations({ locale: review.author.locale, namespace: "Notifications" });
  const emailResult = await sendEmail({
    to: review.author.email,
    subject: t("reviewReplySubject"),
    html: `<p>${t("greeting")}</p><p>${t("reviewReplyBody", {
      name: escapeHtml(responderName),
      reply: escapeHtml(replyText),
    })}</p><p><a href="${targetLink}">${t("reviewReplyLink")}</a></p>`,
  }).catch((err) => {
    console.error(`[EMAIL notification réponse à un avis] échec envoi: ${(err as Error).message}`);
    return null;
  });
  if (emailResult?.previewUrl) {
    console.log(`[EMAIL notification réponse à un avis] ${emailResult.previewUrl}`);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const allowed = await checkCanReply(user.id, review);
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.review.update({ where: { id }, data: { reply: null, repliedAt: null } });

  return NextResponse.json({ ok: true });
}
