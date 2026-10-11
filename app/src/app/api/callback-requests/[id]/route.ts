import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveProAccess } from "@/lib/pro-access";

const bodySchema = z.object({
  status: z.enum(["NOUVEAU", "RAPPELE", "ANNULE"]).optional(),
  note: z.string().trim().max(500).optional(),
});

export const PATCH = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const resolved = await resolveProAccess(user);
  if (!resolved) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { id } = await params;
  const existing = await prisma.callbackRequest.findUnique({ where: { id } });
  if (!existing || existing.proAccountId !== resolved.account.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const updated = await prisma.callbackRequest.update({
    where: { id },
    data: {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.note !== undefined ? { note: body.note || null } : {}),
    },
  });

  return NextResponse.json({ status: updated.status, note: updated.note });
});
