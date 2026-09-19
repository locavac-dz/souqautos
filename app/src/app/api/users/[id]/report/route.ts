import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { checkCanReportUser, validateReportSubmission } from "@/lib/reports";

const bodySchema = z.object({
  reason: z.enum(["COMPORTEMENT_FRAUDULEUX", "MESSAGES_ABUSIFS", "USURPATION_IDENTITE", "AUTRE"]),
  comment: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`report-user:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;

  const eligibility = checkCanReportUser({ isSelf: user.id === id });
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const validation = validateReportSubmission(parsed.data);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const existing = await prisma.report.findUnique({
    where: { reportedUserId_authorId: { reportedUserId: id, authorId: user.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "already_reported" }, { status: 409 });
  }

  try {
    await prisma.report.create({
      data: {
        reportedUserId: id,
        authorId: user.id,
        reason: parsed.data.reason,
        comment: parsed.data.comment?.trim() || null,
      },
    });
  } catch (error) {
    // Deux signalements simultanés du même utilisateur : la base en retient un.
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "already_reported" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
