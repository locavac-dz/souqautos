import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isStaff } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.review.delete({ where: { id } });

  await writeAuditLog({
    adminId: user.id,
    action: "review.delete",
    targetType: "Review",
    targetId: id,
    details: {
      sellerId: review.sellerId,
      professionalAccountId: review.professionalAccountId,
      authorId: review.authorId,
      rating: review.rating,
    },
  });

  return NextResponse.json({ ok: true });
}
