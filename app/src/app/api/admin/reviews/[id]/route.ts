import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireRole, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";

const patchSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export const PATCH = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole(isStaff);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const body = await parseJsonBody(request, patchSchema);
  if (body instanceof NextResponse) return body;

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.review.update({ where: { id }, data: { status: body.status } });

  await writeAuditLog({
    adminId: user.id,
    action: `review.${body.status.toLowerCase()}`,
    targetType: "Review",
    targetId: id,
    details: {
      sellerId: review.sellerId,
      professionalAccountId: review.professionalAccountId,
      authorId: review.authorId,
      rating: review.rating,
      status: body.status,
    },
  });

  return NextResponse.json({ ok: true });
});

export const DELETE = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole(isStaff);
  if (user instanceof NextResponse) return user;

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
});
