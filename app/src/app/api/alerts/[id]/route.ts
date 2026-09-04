import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const alert = await prisma.searchAlert.findUnique({ where: { id } });
  if (!alert || alert.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.searchAlert.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
