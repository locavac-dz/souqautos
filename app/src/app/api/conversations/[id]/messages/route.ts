import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkCanMessage, checkMessageHasContent, shouldSendMessageNotification } from "@/lib/messaging";
import { canAccessConversation } from "@/lib/listing-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";
import { saveMessageAttachment, PhotoValidationError, saveVoiceMessage, VoiceValidationError } from "@/lib/uploads";
import { publishToConversation } from "@/lib/realtime";
import { createNotification } from "@/lib/notification-service";

const bodySchema = z.object({ content: z.string().trim().max(2000) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`send-message:${user.id}`, { limit: 60, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { listing: { select: { title: true } } },
  });
  if (!conversation || !(await canAccessConversation(user.id, conversation))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const otherUserId = conversation.buyerId === user.id ? conversation.sellerId : conversation.buyerId;
  const [blockedByOther, blockedOther] = await Promise.all([
    prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: otherUserId, blockedId: user.id } },
    }),
    prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: otherUserId } },
    }),
  ]);

  const check = checkCanMessage({ isSelf: false, isBlocked: Boolean(blockedByOther || blockedOther) });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse({ content: formData.get("content") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const attachmentFile = formData.get("attachment");
  const hasAttachmentFile = attachmentFile instanceof File && attachmentFile.size > 0;
  const voiceFile = formData.get("voice");
  const hasVoiceFile = voiceFile instanceof File && voiceFile.size > 0;

  const contentCheck = checkMessageHasContent({
    hasText: parsed.data.content.length > 0,
    hasAttachment: hasAttachmentFile,
    hasVoice: hasVoiceFile,
  });
  if (!contentCheck.ok) {
    return NextResponse.json({ error: contentCheck.error }, { status: 400 });
  }

  let attachmentUrl: string | null = null;
  if (hasAttachmentFile) {
    try {
      attachmentUrl = await saveMessageAttachment(attachmentFile as File);
    } catch (err) {
      if (err instanceof PhotoValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  let audioUrl: string | null = null;
  if (hasVoiceFile) {
    try {
      audioUrl = await saveVoiceMessage(voiceFile as File);
    } catch (err) {
      if (err instanceof VoiceValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  const unreadCountBeforeThisMessage = await prisma.message.count({
    where: { conversationId: id, senderId: user.id, readAt: null },
  });

  const message = await prisma.message.create({
    data: { conversationId: id, senderId: user.id, content: parsed.data.content, attachmentUrl, audioUrl },
    select: { id: true, content: true, attachmentUrl: true, audioUrl: true, senderId: true, createdAt: true },
  });

  await publishToConversation(id, {
    type: "message",
    message: { ...message, deletedAt: null, createdAt: message.createdAt.toISOString() },
  });

  // Un nouveau message ramène la conversation dans les deux boîtes de
  // réception, même si l'une des deux parties l'avait masquée (Lot 26).
  if (conversation.hiddenByBuyerAt || conversation.hiddenBySellerAt) {
    await prisma.conversation.update({
      where: { id },
      data: { hiddenByBuyerAt: null, hiddenBySellerAt: null },
    });
  }

  if (shouldSendMessageNotification({ unreadCountBeforeThisMessage })) {
    const [sender, recipient] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id }, include: { profile: true } }),
      prisma.user.findUnique({ where: { id: otherUserId } }),
    ]);
    if (sender && recipient) {
      const senderName = escapeHtml(sender.profile?.displayName ?? sender.email);
      const listingTitle = escapeHtml(conversation.listing.title);
      const messageHtml = parsed.data.content
        ? escapeHtml(parsed.data.content)
        : audioUrl
          ? "[Message vocal]"
          : "[Pièce jointe]";
      const threadLink = `${SITE_URL}/${recipient.locale}/compte/messages/${id}`;
      const emailResult = await sendEmail({
        to: recipient.email,
        subject: `Nouveau message de ${senderName} — Souq Auto`,
        html: `<p>Bonjour,</p><p>${senderName} vous a envoyé un message à propos de « ${listingTitle} » :</p><p style="white-space:pre-wrap">${messageHtml}</p><p><a href="${threadLink}">Répondre sur Souq Auto</a></p>`,
      }).catch(() => null);
      if (emailResult?.previewUrl) {
        console.log(`[EMAIL notification nouveau message] ${emailResult.previewUrl}`);
      }

      await createNotification(otherUserId, "NEW_MESSAGE", {
        url: `/${recipient.locale}/compte/messages/${id}`,
        body: conversation.listing.title,
      });
    }
  }

  return NextResponse.json({ message }, { status: 201 });
}
