import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const alert = await prisma.searchAlert.findUnique({ where: { id } });
  if (!alert || alert.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.searchAlert.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
