import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { invalidateReferenceData } from "@/lib/reference-data";
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
  const brandId = parsePositiveIntId(id);
  if (brandId === null) {
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

  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Le slug ne change jamais après création (stabilité des URL SEO
  // /voitures/[brand]) — seul le nom affiché est modifiable.
  await prisma.brand.update({ where: { id: brandId }, data: { name } });
  invalidateReferenceData();

  await writeAuditLog({
    adminId: user.id,
    action: "brand.update",
    targetType: "Brand",
    targetId: id,
    details: { previousName: brand.name, newName: name },
  });

  return NextResponse.json({ name });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const [modelCount, listingCount] = await Promise.all([
    prisma.model.count({ where: { brandId } }),
    prisma.listing.count({ where: { brandId } }),
  ]);
  if (modelCount > 0) {
    return NextResponse.json({ error: "has_models" }, { status: 409 });
  }
  if (listingCount > 0) {
    return NextResponse.json({ error: "has_listings" }, { status: 409 });
  }

  await prisma.brand.delete({ where: { id: brandId } });
  invalidateReferenceData();

  await writeAuditLog({
    adminId: user.id,
    action: "brand.delete",
    targetType: "Brand",
    targetId: id,
    details: { name: brand.name, slug: brand.slug },
  });

  return NextResponse.json({ ok: true });
}
