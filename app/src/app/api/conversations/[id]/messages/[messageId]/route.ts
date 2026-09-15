import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkCanDeleteMessage } from "@/lib/messaging";
import { publishToConversation } from "@/lib/realtime";
import { deleteStoredFile } from "@/lib/uploads";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id, messageId } = await params;
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.conversationId !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const eligibility = checkCanDeleteMessage({
    isSender: message.senderId === user.id,
    alreadyDeleted: message.deletedAt !== null,
  });
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 403 });
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { content: "", attachmentUrl: null, deletedAt: new Date() },
  });

  // Après la mutation seulement, jamais avant — même discipline que la
  // suppression de photo d'annonce/avatar.
  if (message.attachmentUrl) await deleteStoredFile(message.attachmentUrl);

  await publishToConversation(id, { type: "delete", messageId });

  return NextResponse.json({ ok: true });
}
