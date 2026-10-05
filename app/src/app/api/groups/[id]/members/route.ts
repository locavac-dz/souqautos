import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { publishToGroup } from "@/lib/realtime";

const addSchema = z.object({ userId: z.string() });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: user.id } },
  });
  if (!membership) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!membership.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  const { userId } = parsed.data;

  const targetUser = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    include: { profile: true },
  });
  if (!targetUser) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId } },
  });
  if (existing) return NextResponse.json({ error: "already_member" }, { status: 409 });

  const memberCount = await prisma.groupMember.count({ where: { groupId: id } });
  if (memberCount >= 50) return NextResponse.json({ error: "group_full" }, { status: 400 });

  await prisma.groupMember.create({ data: { groupId: id, userId, isAdmin: false } });

  const userName = targetUser.profile?.displayName ?? targetUser.email;
  await publishToGroup(id, { type: "member_added", member: { userId, userName, isAdmin: false } });

  return NextResponse.json({ ok: true, member: { userId, userName, isAdmin: false } }, { status: 201 });
}
