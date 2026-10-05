import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isModerator } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isModerator(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  await writeAuditLog({
    adminId: user.id,
    action: "user.unlock",
    targetType: "User",
    targetId: id,
    details: { previousFailedAttempts: target.failedLoginAttempts },
  });

  return NextResponse.json({ ok: true });
}
