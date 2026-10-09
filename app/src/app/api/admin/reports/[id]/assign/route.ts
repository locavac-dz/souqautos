import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, parseJsonBody } from "@/lib/api-route";
import { isStaff } from "@/lib/auth-server/roles";
import { assignModerationItem } from "@/lib/moderation-assignment";

// Lot 277 — prise en charge / libération d'un signalement dans la file.
const bodySchema = z.object({ action: z.enum(["take", "release"]) });
const STATUS: Record<string, number> = { not_found: 404, already_assigned: 409, not_assigned: 409, race_lost: 409, forbidden: 403 };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(isStaff);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const result = await assignModerationItem({ kind: "report", id, action: body.action, user });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: STATUS[result.error] ?? 400 });
  return NextResponse.json({ assignedToId: result.assignedToId });
}
