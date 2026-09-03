import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isStaff } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";

const bodySchema = z.object({ verified: z.boolean() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const account = await prisma.professionalAccount.findUnique({ where: { id } });
  if (!account) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.professionalAccount.update({
    where: { id },
    data: { badgeVerifie: parsed.data.verified },
  });

  await writeAuditLog({
    adminId: user.id,
    action: parsed.data.verified ? "pro_account.verify" : "pro_account.unverify",
    targetType: "ProfessionalAccount",
    targetId: id,
    details: { nomCommercial: account.nomCommercial },
  });

  return NextResponse.json({ ok: true });
}
