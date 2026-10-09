import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";

const MESSAGES_PAGE_SIZE = 50;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: user.id } },
  });
  if (!membership) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [group, messages] = await Promise.all([
    prisma.groupConversation.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { include: { profile: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    }),
    prisma.groupMessage.findMany({
      where: { groupId: id },
      orderBy: { createdAt: "desc" },
      take: MESSAGES_PAGE_SIZE,
      include: { sender: { include: { profile: true } } },
    }),
  ]);

  if (!group) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Mettre à jour lastReadAt pour ce membre
  await prisma.groupMember.update({
    where: { groupId_userId: { groupId: id, userId: user.id } },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      createdById: group.createdById,
      isAdmin: membership.isAdmin,
      members: group.members.map((m) => ({
        userId: m.userId,
        userName: m.user.profile?.displayName ?? m.user.email,
        isAdmin: m.isAdmin,
      })),
    },
    messages: messages.reverse().map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.sender.profile?.displayName ?? m.sender.email,
      content: m.content,
      attachmentUrl: m.attachmentUrl,
      audioUrl: m.audioUrl,
      deletedAt: m.deletedAt,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
