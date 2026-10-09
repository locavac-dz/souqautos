import { NextRequest, NextResponse } from "next/server";
import { requireRole, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin, isSuperAdmin } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";

const bodySchema = z.object({
  role: z.enum(["PARTICULIER", "PROFESSIONNEL", "MODERATEUR", "SUPPORT", "ADMIN", "SUPER_ADMIN"]),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(isAdmin);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  if (id === user.id) {
    // Empêche un admin de se retirer lui-même ses droits par erreur (risque de verrouillage).
    return NextResponse.json({ error: "cannot_change_own_role" }, { status: 400 });
  }

  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Seul un SUPER_ADMIN peut attribuer ou révoquer le rôle SUPER_ADMIN.
  // Un simple ADMIN ne peut pas non plus dégrader un SUPER_ADMIN.
  const targetIsSuperAdmin = isSuperAdmin(target.role);
  const requesterIsSuperAdmin = isSuperAdmin(user.role);
  if (!requesterIsSuperAdmin && (targetIsSuperAdmin || body.role === "SUPER_ADMIN")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.user.update({ where: { id }, data: { role: body.role } });

  await writeAuditLog({
    adminId: user.id,
    action: "user.role_change",
    targetType: "User",
    targetId: id,
    details: { previousRole: target.role, newRole: body.role },
  });

  return NextResponse.json({ role: body.role });
}
