import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isStaff } from "@/lib/auth-server/roles";
import { computeIdentityReviewTransition, type IdentityReviewAction } from "@/lib/identity-verification";
import { deleteIdentityDocument } from "@/lib/identity-uploads";
import { writeAuditLog } from "@/lib/audit-log";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});

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

  const identityRequest = await prisma.identityVerificationRequest.findUnique({ where: { id } });
  if (!identityRequest) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const action: IdentityReviewAction = parsed.data.action;
  const transition = computeIdentityReviewTransition(identityRequest.status, action, parsed.data.reason);
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 400 });
  }

  await prisma.identityVerificationRequest.update({
    where: { id },
    data: {
      status: transition.newStatus,
      reviewedById: user.id,
      reviewedAt: new Date(),
      reviewNote: parsed.data.reason?.trim() || null,
      // Aucune conservation indéfinie de la pièce une fois la décision prise.
      documentPath: null,
      documentMime: null,
    },
  });

  if (identityRequest.documentPath) {
    await deleteIdentityDocument(identityRequest.documentPath);
  }

  if (action === "approve") {
    await prisma.user.update({
      where: { id: identityRequest.userId },
      data: { identityVerifiedAt: new Date() },
    });
  }

  await writeAuditLog({
    adminId: user.id,
    action: `identity_verification.${action}`,
    targetType: "IdentityVerificationRequest",
    targetId: id,
    details: { requesterId: identityRequest.userId, reason: parsed.data.reason ?? null },
  });

  return NextResponse.json({ status: transition.newStatus });
}
