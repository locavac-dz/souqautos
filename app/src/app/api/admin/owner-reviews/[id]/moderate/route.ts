import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isStaff } from "@/lib/auth-server/roles";
import { ownerReviewModerationSchema } from "@/lib/validation/owner-review";
import { computeModerationTransition, validateRejectionReason } from "@/lib/owner-review";
import { sendOwnerReviewDecisionEmail } from "@/lib/owner-review-email";
import { writeAuditLog } from "@/lib/audit-log";

// Lot 116 — validation d'un avis de propriétaire par l'équipe (MODERATEUR ou
// ADMIN, comme la modération des annonces). Un refus exige un motif, transmis à
// l'auteur ; une validation publie l'avis.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = ownerReviewModerationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }
  const { action } = parsed.data;

  const review = await prisma.ownerReview.findUnique({ where: { id }, select: { id: true, status: true, modelId: true } });
  if (!review) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const transition = computeModerationTransition(review.status, action);
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 409 });
  }

  let reason: string | null = null;
  if (action === "reject") {
    const validation = validateRejectionReason(parsed.data.reason);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    reason = validation.reason;
  }

  const now = new Date();
  // Filtré sur l'état attendu : deux modérateurs qui valident en même temps ne
  // publient pas deux fois, le second reçoit un conflit.
  const updated = await prisma.ownerReview.updateMany({
    where: { id, status: "EN_ATTENTE" },
    data: {
      status: transition.newStatus,
      rejectionReason: reason,
      moderatedAt: now,
      publishedAt: action === "approve" ? now : null,
    },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "invalid_transition" }, { status: 409 });
  }

  await writeAuditLog({
    adminId: user.id,
    action: `owner_review.${action}`,
    targetType: "OwnerReview",
    targetId: id,
    details: { modelId: review.modelId, newStatus: transition.newStatus, reason },
  });

  await sendOwnerReviewDecisionEmail(id, action === "approve" ? "approved" : "rejected");

  return NextResponse.json({ status: transition.newStatus });
}
