import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { validateCatalogueName } from "@/lib/catalogue-admin";
import { slugify } from "@/lib/slugify";
import { writeAuditLog } from "@/lib/audit-log";
import { parsePositiveIntId } from "@/lib/validation/int-bounds";
import { isUniqueViolation } from "@/lib/prisma-errors";

const bodySchema = z.object({ name: z.string() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const brandId = parsePositiveIntId(id);
  if (brandId === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) {
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

  const slug = slugify(name);
  const existing = await prisma.model.findUnique({ where: { brandId_slug: { brandId, slug } } });
  if (existing) {
    return NextResponse.json({ error: "slug_taken" }, { status: 409 });
  }

  let model;
  try {
    model = await prisma.model.create({ data: { brandId, name, slug } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }
    throw error;
  }

  await writeAuditLog({
    adminId: user.id,
    action: "model.create",
    targetType: "Model",
    targetId: String(model.id),
    details: { brandId, name, slug },
  });

  return NextResponse.json({ model }, { status: 201 });
}
