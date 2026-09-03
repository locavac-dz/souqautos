import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isStaff } from "@/lib/auth-server/roles";
import { computeModerationTransition, type ModerationAction } from "@/lib/moderation";
import { writeAuditLog } from "@/lib/audit-log";

const bodySchema = z.object({
  action: z.enum(["approve", "reject", "suspend"]),
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

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const action: ModerationAction = parsed.data.action;
  const transition = computeModerationTransition(listing.status, action, parsed.data.reason);
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 400 });
  }

  const isApproval = action === "approve";
  await prisma.listing.update({
    where: { id },
    data: {
      status: transition.newStatus,
      moderationNote: isApproval ? null : (parsed.data.reason?.trim() ?? null),
      publishedAt: isApproval && !listing.publishedAt ? new Date() : listing.publishedAt,
    },
  });

  await writeAuditLog({
    adminId: user.id,
    action: `listing.${action}`,
    targetType: "Listing",
    targetId: id,
    details: {
      previousStatus: listing.status,
      newStatus: transition.newStatus,
      reason: parsed.data.reason ?? null,
    },
  });

  return NextResponse.json({ status: transition.newStatus });
}
