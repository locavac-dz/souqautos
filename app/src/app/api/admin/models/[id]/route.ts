import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireRole, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { invalidateReferenceData } from "@/lib/reference-data";
import { isAdmin } from "@/lib/auth-server/roles";
import { validateCatalogueName } from "@/lib/catalogue-admin";
import { writeAuditLog } from "@/lib/audit-log";
import { parsePositiveIntId } from "@/lib/validation/int-bounds";
import { normalizeModelCategories } from "@/lib/vehicle-catalogue";

// Lot 130 — `categories` facultatif : absent = catégories inchangées.
const bodySchema = z.object({ name: z.string(), categories: z.unknown().optional() });

export const PATCH = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole(isAdmin);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const modelId = parsePositiveIntId(id);
  if (modelId === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const name = body.name.trim();
  const validation = validateCatalogueName(name);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const categories = body.categories === undefined ? undefined : normalizeModelCategories(body.categories);
  if (categories === null) {
    return NextResponse.json({ error: "invalid_categories" }, { status: 400 });
  }

  const model = await prisma.model.findUnique({ where: { id: modelId } });
  if (!model) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Même règle que pour les marques : le slug ne change jamais après création.
  await prisma.model.update({ where: { id: modelId }, data: { name, ...(categories ? { categories } : {}) } });
  invalidateReferenceData();

  await writeAuditLog({
    adminId: user.id,
    action: "model.update",
    targetType: "Model",
    targetId: id,
    details: { previousName: model.name, newName: name, ...(categories ? { previousCategories: model.categories, newCategories: categories } : {}) },
  });

  return NextResponse.json({ name, categories: categories ?? model.categories });
});

export const DELETE = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole(isAdmin);
  if (user instanceof NextResponse) return user;

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

  // Lot 126 — un guide d'achat est rattaché à son modèle : on le supprime d'abord (ou on en choisit un autre).
  const guideCount = await prisma.buyingGuide.count({ where: { modelId } });
  if (guideCount > 0) {
    return NextResponse.json({ error: "has_guides" }, { status: 409 });
  }

  await prisma.model.delete({ where: { id: modelId } });
  invalidateReferenceData();

  await writeAuditLog({
    adminId: user.id,
    action: "model.delete",
    targetType: "Model",
    targetId: id,
    details: { name: model.name, slug: model.slug, brandId: model.brandId },
  });

  return NextResponse.json({ ok: true });
});
