import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { validateCatalogueName } from "@/lib/catalogue-admin";
import { writeAuditLog } from "@/lib/audit-log";
import { parsePositiveIntId } from "@/lib/validation/int-bounds";

const bodySchema = z.object({ name: z.string() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const modelId = parsePositiveIntId(id);
  if (modelId === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const name = parsed.data.name.trim();
  const validation = validateCatalogueName(name);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const model = await prisma.model.findUnique({ where: { id: modelId } });
  if (!model) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Même règle que pour les marques : le slug ne change jamais après création.
  await prisma.model.update({ where: { id: modelId }, data: { name } });

  await writeAuditLog({
    adminId: user.id,
    action: "model.update",
    targetType: "Model",
    targetId: id,
    details: { previousName: model.name, newName: name },
  });

  return NextResponse.json({ name });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const modelId = parsePositiveIntId(id);
  if (modelId === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const model = await prisma.model.findUnique({ where: { id: modelId } });
  if (!model) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const listingCount = await prisma.listing.count({ where: { modelId } });
  if (listingCount > 0) {
    return NextResponse.json({ error: "has_listings" }, { status: 409 });
  }

  await prisma.model.delete({ where: { id: modelId } });

  await writeAuditLog({
    adminId: user.id,
    action: "model.delete",
    targetType: "Model",
    targetId: id,
    details: { name: model.name, slug: model.slug, brandId: model.brandId },
  });

  return NextResponse.json({ ok: true });
}
