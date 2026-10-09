import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { publishToGroup } from "@/lib/realtime";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id, userId } = await params;

  const requesterMembership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: user.id } },
  });
  if (!requesterMembership) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Peut quitter soi-même ou retirer quelqu'un si admin
  const isSelf = userId === user.id;
  if (!isSelf && !requesterMembership.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const targetMembership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId } },
  });
  if (!targetMembership) return NextResponse.json({ error: "not_member" }, { status: 404 });

  await prisma.groupMember.delete({ where: { groupId_userId: { groupId: id, userId } } });

  await publishToGroup(id, { type: "member_removed", userId });

  return NextResponse.json({ ok: true });
}
