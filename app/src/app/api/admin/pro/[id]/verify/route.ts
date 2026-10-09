import { NextRequest, NextResponse } from "next/server";
import { requireRole, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";

const bodySchema = z.object({ verified: z.boolean() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(isStaff);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const account = await prisma.professionalAccount.findUnique({ where: { id } });
  if (!account) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.professionalAccount.update({
    where: { id },
    data: { badgeVerifie: body.verified },
  });

  await writeAuditLog({
    adminId: user.id,
    action: body.verified ? "pro_account.verify" : "pro_account.unverify",
    targetType: "ProfessionalAccount",
    targetId: id,
    details: { nomCommercial: account.nomCommercial },
  });

  return NextResponse.json({ ok: true });
}
