import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { validateCatalogueName } from "@/lib/catalogue-admin";
import { slugify } from "@/lib/slugify";
import { writeAuditLog } from "@/lib/audit-log";

const bodySchema = z.object({ name: z.string() });

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
  const existing = await prisma.brand.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "slug_taken" }, { status: 409 });
  }

  const brand = await prisma.brand.create({ data: { name, slug } });

  await writeAuditLog({
    adminId: user.id,
    action: "brand.create",
    targetType: "Brand",
    targetId: String(brand.id),
    details: { name, slug },
  });

  return NextResponse.json({ brand }, { status: 201 });
}
