import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: proAccountId } = await params;
  const proAccount = await prisma.professionalAccount.findUnique({ where: { id: proAccountId } });
  if (!proAccount) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Upsert pour idempotence : un double-clic ne crée pas deux lignes
  await prisma.proFollow.upsert({
    where: { userId_proAccountId: { userId: user.id, proAccountId } },
    create: { userId: user.id, proAccountId },
    update: {},
  });

  return NextResponse.json({ following: true }, { status: 201 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: proAccountId } = await params;
  await prisma.proFollow.deleteMany({ where: { userId: user.id, proAccountId } });

  return NextResponse.json({ following: false });
}
