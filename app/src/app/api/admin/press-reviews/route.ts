import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { pressReviewSchema } from "@/lib/validation/press-review";
import { validateVehicleRefs } from "@/lib/listing-catalogue-refs";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { writeAuditLog } from "@/lib/audit-log";

// Lot 114 — réservé à ADMIN, comme le magazine et les essais : c'est du contenu
// public qui engage l'image de la marque.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = pressReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }
  const data = parsed.data;

  const refs = await validateVehicleRefs(data);
  if (!refs.ok) {
    return NextResponse.json({ error: refs.error }, { status: 400 });
  }
  // La marque se déduit du modèle choisi.
  let brandId = data.brandId ?? null;
  if (data.modelId && !brandId) {
    const model = await prisma.model.findUnique({ where: { id: data.modelId }, select: { brandId: true } });
    brandId = model?.brandId ?? null;
  }

  let review;
  try {
    review = await prisma.pressReview.create({
      data: {
        sourceName: data.sourceName,
        url: data.url,
        title: data.title,
        sourcePublishedAt: data.sourcePublishedAt ? new Date(`${data.sourcePublishedAt}T00:00:00Z`) : null,
        noteFr: data.noteFr,
        noteAr: data.noteAr,
        brandId,
        modelId: data.modelId ?? null,
        publishedAt: data.published ? new Date() : null,
      },
      select: { id: true },
    });
  } catch (error) {
    // Le même article ne figure qu'une fois (adresse unique, y compris si deux
    // administrateurs l'ajoutent en même temps).
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "url_taken" }, { status: 409 });
    }
    throw error;
  }

  await writeAuditLog({
    adminId: user.id,
    action: "press_review.create",
    targetType: "PressReview",
    targetId: review.id,
    details: { sourceName: data.sourceName, url: data.url, published: data.published },
  });

  return NextResponse.json({ review }, { status: 201 });
}
