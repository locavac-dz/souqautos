import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireRole, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { invalidateReferenceData } from "@/lib/reference-data";
import { isAdmin } from "@/lib/auth-server/roles";
import { validateCatalogueName } from "@/lib/catalogue-admin";
import { slugify } from "@/lib/slugify";
import { writeAuditLog } from "@/lib/audit-log";
import { isUniqueViolation } from "@/lib/prisma-errors";

const bodySchema = z.object({ name: z.string() });

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireRole(isAdmin);
  if (user instanceof NextResponse) return user;

  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const name = body.name.trim();
  const validation = validateCatalogueName(name);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const slug = slugify(name);
  const existing = await prisma.brand.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "slug_taken" }, { status: 409 });
  }

  let brand;
  try {
    brand = await prisma.brand.create({ data: { name, slug } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }
    throw error;
  }
  invalidateReferenceData();

  await writeAuditLog({
    adminId: user.id,
    action: "brand.create",
    targetType: "Brand",
    targetId: String(brand.id),
    details: { name, slug },
  });

  return NextResponse.json({ brand }, { status: 201 });
});
