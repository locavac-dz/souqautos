import { NextRequest, NextResponse } from "next/server";
import { requireRole, parseJsonBody } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth-server/roles";
import { pressReviewSchema } from "@/lib/validation/press-review";
import { validateVehicleRefs } from "@/lib/listing-catalogue-refs";
import { resolvePublishedAt } from "@/lib/blog-publication";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { writeAuditLog } from "@/lib/audit-log";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(isAdmin);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const body = await parseJsonBody(request, pressReviewSchema);
  if (body instanceof NextResponse) return body;
  const data = body;

  const existing = await prisma.pressReview.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const refs = await validateVehicleRefs(data);
  if (!refs.ok) {
    return NextResponse.json({ error: refs.error }, { status: 400 });
  }
  let brandId = data.brandId ?? null;
  if (data.modelId && !brandId) {
    const model = await prisma.model.findUnique({ where: { id: data.modelId }, select: { brandId: true } });
    brandId = model?.brandId ?? null;
  }

  // « En ligne » sur une entrée déjà en ligne garde sa date d'origine : une
  // correction ne la fait pas remonter en tête de la liste.
  const publishedAt = resolvePublishedAt({ mode: data.published ? "now" : "draft" }, existing.publishedAt, new Date());

  try {
    await prisma.pressReview.update({
      where: { id },
      data: {
        sourceName: data.sourceName,
        url: data.url,
        title: data.title,
        sourcePublishedAt: data.sourcePublishedAt ? new Date(`${data.sourcePublishedAt}T00:00:00Z`) : null,
        noteFr: data.noteFr,
        noteAr: data.noteAr,
        brandId,
        modelId: data.modelId ?? null,
        publishedAt,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "url_taken" }, { status: 409 });
    }
    throw error;
  }

  await writeAuditLog({
    adminId: user.id,
    action: "press_review.update",
    targetType: "PressReview",
    targetId: id,
    details: { sourceName: data.sourceName, url: data.url, published: data.published },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(isAdmin);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const existing = await prisma.pressReview.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.pressReview.delete({ where: { id } });

  await writeAuditLog({
    adminId: user.id,
    action: "press_review.delete",
    targetType: "PressReview",
    targetId: id,
    details: { sourceName: existing.sourceName, url: existing.url },
  });

  return NextResponse.json({ ok: true });
}
