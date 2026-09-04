import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { canManageCollaborators } from "@/lib/pro-account";
import { serializeProPermissions } from "@/lib/pro-permissions";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().trim().email(),
  permissions: z.object({
    gererAnnonces: z.boolean().default(false),
    repondreAvis: z.boolean().default(false),
  }),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const account = await prisma.professionalAccount.findUnique({ where: { id } });
  if (!account) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!canManageCollaborators({ isOwner: account.userId === user.id, permissions: null })) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!checkRateLimit(`add-collaborator:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!targetUser) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  if (targetUser.id === account.userId) {
    return NextResponse.json({ error: "cannot_add_self" }, { status: 400 });
  }

  const existing = await prisma.proCollaborator.findUnique({
    where: { professionalAccountId_userId: { professionalAccountId: id, userId: targetUser.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "already_collaborator" }, { status: 400 });
  }

  const collaborator = await prisma.proCollaborator.create({
    data: {
      professionalAccountId: id,
      userId: targetUser.id,
      permissions: serializeProPermissions(parsed.data.permissions),
    },
  });

  return NextResponse.json({ collaborator }, { status: 201 });
}
