import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { isModerator } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(isModerator);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id },
    data: { suspendedAt: null, suspensionReason: null },
  });

  await writeAuditLog({
    adminId: user.id,
    action: "user.unsuspend",
    targetType: "User",
    targetId: id,
    details: { previousReason: target.suspensionReason },
  });

  return NextResponse.json({ ok: true });
}
