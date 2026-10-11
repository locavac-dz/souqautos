import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { publishToGroup } from "@/lib/realtime";
import { checkRateLimit } from "@/lib/rate-limit";

const addSchema = z.object({ email: z.string().email() });

// Lot 267 (audit B6) — 30 ajouts par heure et par compte : la réponse 404 / 409 révèle si une adresse a un compte
// (nécessaire pour l'administrateur du groupe), le plafond empêche d'en faire un outil d'énumération.
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (!(await checkRateLimit(`group-add-member:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: user.id } },
  });
  if (!membership) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!membership.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await parseJsonBody(request, addSchema);
  if (body instanceof NextResponse) return body;

  const { email } = body;

  const targetUser = await prisma.user.findUnique({
    where: { email, deletedAt: null },
    include: { profile: true },
  });
  if (!targetUser) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const userId = targetUser.id;

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
});
