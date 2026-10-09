import { NextRequest, NextResponse } from "next/server";
import { requireRole, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isModerator, isStaff } from "@/lib/auth-server/roles";
import { checkCanSuspendUser } from "@/lib/user-suspension";
import { writeAuditLog } from "@/lib/audit-log";
import { sendAccountSuspendedEmail } from "@/lib/account-suspension-email";

const bodySchema = z.object({ reason: z.string().trim().min(1).max(500) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(isModerator);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const eligibility = checkCanSuspendUser({
    isSelf: target.id === user.id,
    targetIsStaff: isStaff(target.role),
  });
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 400 });
  }

  const reason = body.reason.trim();
  await prisma.user.update({
    where: { id },
    data: { suspendedAt: new Date(), suspensionReason: reason },
  });

  await writeAuditLog({
    adminId: user.id,
    action: "user.suspend",
    targetType: "User",
    targetId: id,
    details: { reason },
  });

  await sendAccountSuspendedEmail(id, reason);

  return NextResponse.json({ ok: true });
}
