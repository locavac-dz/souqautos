import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { deleteStoredFile } from "@/lib/uploads";
import { publishToGroup } from "@/lib/realtime";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id, messageId } = await params;

  const message = await prisma.groupMessage.findUnique({ where: { id: messageId } });
  if (!message || message.groupId !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (message.senderId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (message.deletedAt) {
    return NextResponse.json({ error: "already_deleted" }, { status: 403 });
  }

  await prisma.groupMessage.update({
    where: { id: messageId },
    data: { content: "", attachmentUrl: null, audioUrl: null, deletedAt: new Date() },
  });

  if (message.attachmentUrl) await deleteStoredFile(message.attachmentUrl);
  if (message.audioUrl) await deleteStoredFile(message.audioUrl);

  await publishToGroup(id, { type: "delete", messageId });

  return NextResponse.json({ ok: true });
}
