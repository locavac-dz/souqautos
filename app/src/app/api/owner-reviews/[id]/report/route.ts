import { NextRequest, NextResponse, after } from "next/server";
import { apiHandler, requireUser, parseJsonBody } from "@/lib/api-route";
import { notifyStaffOfPending } from "@/lib/staff-alerts";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { ownerReviewReportSchema } from "@/lib/validation/owner-review";
import { isUniqueViolation } from "@/lib/prisma-errors";
import type { ReportReason } from "@prisma/client";

// Lot 116 — signalement d'un avis de propriétaire PUBLIÉ (propos injurieux,
// avis manifestement de complaisance ou inventé…). Le signalement rejoint la
// file habituelle de /admin/signalements ; l'avis reste en ligne tant que
// l'équipe n'a pas confirmé (jamais de retrait automatique sur un signalement
// non vérifié, même règle que les annonces).
export const POST = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`report-owner-review:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const body = await parseJsonBody(request, ownerReviewReportSchema);
  if (body instanceof NextResponse) return body;

  const review = await prisma.ownerReview.findUnique({ where: { id }, select: { id: true, userId: true, status: true } });
  // Un avis non publié n'est vu que de son auteur et de l'équipe : inutile (et
  // révélateur) de le signaler.
  if (!review || review.status !== "PUBLIE") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (review.userId === user.id) {
    return NextResponse.json({ error: "cannot_report_self" }, { status: 400 });
  }

  try {
    await prisma.report.create({
      data: {
        ownerReviewId: review.id,
        authorId: user.id,
        reason: body.reason as ReportReason,
        comment: body.comment || null,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "already_reported" }, { status: 409 });
    }
    throw error;
  }

  // Lot 118 — prévient l'équipe (après la réponse).
  after(() => notifyStaffOfPending("report"));

  return NextResponse.json({ ok: true }, { status: 201 });
});
