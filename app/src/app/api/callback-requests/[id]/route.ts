import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { resolveProAccess } from "@/lib/pro-access";

const bodySchema = z.object({
  status: z.enum(["NOUVEAU", "RAPPELE", "ANNULE"]).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const resolved = await resolveProAccess(user);
  if (!resolved) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { id } = await params;
  const existing = await prisma.callbackRequest.findUnique({ where: { id } });
  if (!existing || existing.proAccountId !== resolved.account.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  const updated = await prisma.callbackRequest.update({
    where: { id },
    data: {
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.note !== undefined ? { note: parsed.data.note || null } : {}),
    },
  });

  return NextResponse.json({ status: updated.status, note: updated.note });
}
