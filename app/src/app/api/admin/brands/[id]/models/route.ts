import { NextRequest, NextResponse } from "next/server";
import { requireRole, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { invalidateReferenceData } from "@/lib/reference-data";
import { isAdmin } from "@/lib/auth-server/roles";
import { validateCatalogueName } from "@/lib/catalogue-admin";
import { slugify } from "@/lib/slugify";
import { writeAuditLog } from "@/lib/audit-log";
import { parsePositiveIntId } from "@/lib/validation/int-bounds";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { normalizeModelCategories, type CatalogueCategory } from "@/lib/vehicle-catalogue";

// Lot 130 — `categories` (voiture, utilitaire, poids lourd, deux-roues) : facultatif, « voiture » par défaut.
const bodySchema = z.object({ name: z.string(), categories: z.unknown().optional() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(isAdmin);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const brandId = parsePositiveIntId(id);
  if (brandId === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const name = body.name.trim();
  const validation = validateCatalogueName(name);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  let categories: CatalogueCategory[] = ["VOITURE"];
  if (body.categories !== undefined) {
    const normalized = normalizeModelCategories(body.categories);
    if (!normalized) return NextResponse.json({ error: "invalid_categories" }, { status: 400 });
    categories = normalized;
  }

  const slug = slugify(name);
  const existing = await prisma.model.findUnique({ where: { brandId_slug: { brandId, slug } } });
  if (existing) {
    return NextResponse.json({ error: "slug_taken" }, { status: 409 });
  }

  let model;
  try {
    model = await prisma.model.create({ data: { brandId, name, slug, categories } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }
    throw error;
  }
  invalidateReferenceData();

  await writeAuditLog({
    adminId: user.id,
    action: "model.create",
    targetType: "Model",
    targetId: String(model.id),
    details: { brandId, name, slug, categories },
  });

  return NextResponse.json({ model }, { status: 201 });
}
