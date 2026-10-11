import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { checkRateLimit } from "@/lib/rate-limit";

export const POST = apiHandler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`user:block:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id: blockedId } = await params;
  if (blockedId === user.id) {
    return NextResponse.json({ error: "cannot_block_self" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: blockedId } });
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId } },
      update: {},
      create: { blockerId: user.id, blockedId },
    });
  } catch (error) {
    // Requêtes simultanées : le blocage existe déjà, c'est le résultat demandé.
    if (!isUniqueViolation(error)) throw error;
  }

  return NextResponse.json({ blocked: true }, { status: 201 });
});

export const DELETE = apiHandler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id: blockedId } = await params;
  await prisma.block.deleteMany({ where: { blockerId: user.id, blockedId } });

  return NextResponse.json({ blocked: false });
});
