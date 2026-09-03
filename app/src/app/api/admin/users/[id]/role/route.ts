import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";

const bodySchema = z.object({
  role: z.enum(["PARTICULIER", "PROFESSIONNEL", "MODERATEUR", "ADMIN"]),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (id === user.id) {
    // Empêche un admin de se retirer lui-même ses droits par erreur (risque de verrouillage).
    return NextResponse.json({ error: "cannot_change_own_role" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.user.update({ where: { id }, data: { role: parsed.data.role } });

  await writeAuditLog({
    adminId: user.id,
    action: "user.role_change",
    targetType: "User",
    targetId: id,
    details: { previousRole: target.role, newRole: parsed.data.role },
  });

  return NextResponse.json({ role: parsed.data.role });
}
