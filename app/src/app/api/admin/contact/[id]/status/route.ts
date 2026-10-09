import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, parseJsonBody } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { computeContactTransition } from "@/lib/contact-messages";

// Lot 273 — file des messages de contact : prise en charge, réponse faite, réouverture. Toute l'équipe (SUPPORT
// compris) peut traiter ; la réponse elle-même part par courriel depuis la boîte de l'équipe (Reply-To), pas d'ici.
const bodySchema = z.object({
  action: z.enum(["take", "answered", "reopen"]),
  note: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(isStaff);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const message = await prisma.contactMessage.findUnique({ where: { id }, select: { status: true, handledById: true } });
  if (!message) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const transition = computeContactTransition(message.status, body.action);
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 400 });
  }

  const now = new Date();
  // Même garde de course que la modération : on n'écrase que le statut lu.
  const { count } = await prisma.contactMessage.updateMany({
    where: { id, status: message.status },
    data: {
      status: transition.newStatus,
      handledById: message.handledById ?? user.id,
      ...(body.note !== undefined ? { note: body.note || null } : {}),
      ...(transition.newStatus === "REPONDU" ? { answeredAt: now } : {}),
    },
  });
  if (count === 0) {
    return NextResponse.json({ error: "invalid_transition" }, { status: 400 });
  }

  await writeAuditLog({
    adminId: user.id,
    action: `contact.${body.action}`,
    targetType: "ContactMessage",
    targetId: id,
    details: { previousStatus: message.status, newStatus: transition.newStatus, note: body.note ?? null },
  });

  return NextResponse.json({ status: transition.newStatus });
}
