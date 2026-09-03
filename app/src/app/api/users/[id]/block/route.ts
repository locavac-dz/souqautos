import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id: blockedId } = await params;
  if (blockedId === user.id) {
    return NextResponse.json({ error: "cannot_block_self" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: blockedId } });
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId } },
    update: {},
    create: { blockerId: user.id, blockedId },
  });

  return NextResponse.json({ blocked: true }, { status: 201 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id: blockedId } = await params;
  await prisma.block.deleteMany({ where: { blockerId: user.id, blockedId } });

  return NextResponse.json({ blocked: false });
}
