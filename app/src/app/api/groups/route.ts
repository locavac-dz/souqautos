import { NextRequest, NextResponse } from "next/server";
import { requireUser, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_MEMBERS = 50;
const MAX_NAME_LENGTH = 80;

const createSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  memberIds: z.array(z.string()).min(1).max(MAX_MEMBERS - 1),
});

// GET /api/groups — liste les groupes de l'utilisateur connecté
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    include: {
      group: {
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { group: { updatedAt: "desc" } },
  });

  const groups = memberships.map(({ group, isAdmin, lastReadAt }) => ({
    id: group.id,
    name: group.name,
    isAdmin,
    memberCount: group._count.members,
    lastMessage: group.messages[0] ?? null,
    hasUnread: group.messages[0]
      ? !lastReadAt || group.messages[0].createdAt > lastReadAt
      : false,
  }));

  return NextResponse.json({ groups });
}

// POST /api/groups — créer un nouveau groupe
export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`create-group:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, createSchema);
  if (body instanceof NextResponse) return body;

  const { name, memberIds } = body;

  // Dédoublonner et exclure le créateur (il sera admin)
  const uniqueMemberIds = [...new Set(memberIds.filter((id) => id !== user.id))];
  if (uniqueMemberIds.length === 0) {
    return NextResponse.json({ error: "no_members" }, { status: 400 });
  }

  // Vérifier que tous les utilisateurs existent
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueMemberIds }, deletedAt: null },
    select: { id: true },
  });
  if (users.length !== uniqueMemberIds.length) {
    return NextResponse.json({ error: "invalid_members" }, { status: 400 });
  }

  const group = await prisma.groupConversation.create({
    data: {
      name,
      createdById: user.id,
      members: {
        create: [
          { userId: user.id, isAdmin: true },
          ...uniqueMemberIds.map((userId) => ({ userId, isAdmin: false })),
        ],
      },
    },
    include: { _count: { select: { members: true } } },
  });

  return NextResponse.json({ group: { id: group.id, name: group.name, memberCount: group._count.members } }, { status: 201 });
}
