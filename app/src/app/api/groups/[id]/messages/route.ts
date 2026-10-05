import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { saveMessageAttachment, PhotoValidationError, saveVoiceMessage, VoiceValidationError } from "@/lib/uploads";
import { publishToGroup } from "@/lib/realtime";
import { sendPushToUser } from "@/lib/push-send";

const contentSchema = z.object({ content: z.string().trim().max(2000) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  if (!(await checkRateLimit(`send-group-message:${user.id}`, { limit: 60, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: user.id } },
  });
  if (!membership) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "validation" }, { status: 400 });

  const parsed = contentSchema.safeParse({ content: formData.get("content") ?? "" });
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  const attachmentFile = formData.get("attachment");
  const hasAttachment = attachmentFile instanceof File && attachmentFile.size > 0;
  const voiceFile = formData.get("voice");
  const hasVoice = voiceFile instanceof File && voiceFile.size > 0;

  if (!parsed.data.content && !hasAttachment && !hasVoice) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
  }

  let attachmentUrl: string | null = null;
  if (hasAttachment) {
    try {
      attachmentUrl = await saveMessageAttachment(attachmentFile as File);
    } catch (err) {
      if (err instanceof PhotoValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
      throw err;
    }
  }

  let audioUrl: string | null = null;
  if (hasVoice) {
    try {
      audioUrl = await saveVoiceMessage(voiceFile as File);
    } catch (err) {
      if (err instanceof VoiceValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
      throw err;
    }
  }

  const senderProfile = await prisma.profile.findUnique({ where: { userId: user.id } });
  const senderName = senderProfile?.displayName ?? user.email;

  const message = await prisma.groupMessage.create({
    data: { groupId: id, senderId: user.id, content: parsed.data.content, attachmentUrl, audioUrl },
    select: { id: true, content: true, attachmentUrl: true, audioUrl: true, senderId: true, createdAt: true },
  });

  // Mettre à jour updatedAt du groupe
  await prisma.groupConversation.update({ where: { id }, data: { updatedAt: new Date() } });

  const eventMessage = {
    id: message.id,
    senderId: message.senderId,
    senderName,
    content: message.content,
    attachmentUrl: message.attachmentUrl,
    audioUrl: message.audioUrl,
    deletedAt: null as null,
    createdAt: message.createdAt.toISOString(),
  };

  await publishToGroup(id, { type: "message", message: eventMessage });

  // Notifications push — envoyées en tâche de fond pour ne pas bloquer la réponse.
  after(async () => {
    const group = await prisma.groupConversation.findUnique({
      where: { id },
      select: { name: true },
    });
    if (!group) return;

    const otherMembers = await prisma.groupMember.findMany({
      where: { groupId: id, userId: { not: user.id } },
      select: { user: { select: { id: true, locale: true } } },
    });

    await Promise.allSettled(
      otherMembers.map(async ({ user: member }) => {
        const locale = member.locale ?? "fr";
        const t = await getTranslations({ locale, namespace: "Notifications" });
        await sendPushToUser(member.id, {
          title: t("pushGroupMessageTitle"),
          body: t("pushGroupMessageBody", { senderName, groupName: group.name }),
          url: `/${locale}/compte/groupes/${id}`,
          tag: `group-${id}`,
          lang: locale === "ar" ? "ar" : "fr",
        });
      })
    );
  });

  return NextResponse.json({ message: eventMessage }, { status: 201 });
}
