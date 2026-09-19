import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { blogArticleSchema } from "@/lib/validation/blog";
import { articleStatus, resolvePublishedAt } from "@/lib/blog-publication";
import { toRoadTestData } from "@/lib/road-test-data";
import { validateVehicleRefs } from "@/lib/listing-catalogue-refs";
import { writeAuditLog } from "@/lib/audit-log";

// Le slug n'est jamais recalculé à l'édition — une fois publié, son URL doit
// rester stable (référencement, liens déjà partagés), même si le titre change.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = blogArticleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }
  const data = parsed.data;

  const article = await prisma.blogArticle.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Lot 110 — le type (article / essai) est fixé à la création : passer de
  // l'un à l'autre demanderait de créer ou supprimer la fiche d'essai.
  if (data.kind !== article.kind) {
    return NextResponse.json({ error: "kind_mismatch" }, { status: 400 });
  }

  let brandIdFromModel: number | undefined;
  if (data.roadTest) {
    const refs = await validateVehicleRefs(data.roadTest);
    if (!refs.ok) {
      return NextResponse.json({ error: refs.error }, { status: 400 });
    }
    if (data.roadTest.modelId && !data.roadTest.brandId) {
      const model = await prisma.model.findUnique({
        where: { id: data.roadTest.modelId },
        select: { brandId: true },
      });
      brandIdFromModel = model?.brandId;
    }
  }

  // La date est décidée côté serveur : « Publié » sur un article déjà paru
  // conserve sa date d'origine (jamais republié à chaque simple correction de
  // texte), « Programmé » prend la date demandée, « Brouillon » la retire.
  const now = new Date();
  const publishedAt = resolvePublishedAt(data.publication, article.publishedAt, now);

  const roadTestData = data.roadTest ? toRoadTestData(data.roadTest, brandIdFromModel) : undefined;

  await prisma.blogArticle.update({
    where: { id },
    data: {
      titleFr: data.titleFr,
      titleAr: data.titleAr,
      excerptFr: data.excerptFr,
      excerptAr: data.excerptAr,
      contentFr: data.contentFr,
      contentAr: data.contentAr,
      publishedAt,
      roadTest: roadTestData ? { upsert: { create: roadTestData, update: roadTestData } } : undefined,
    },
  });

  await writeAuditLog({
    adminId: user.id,
    action: "blog_article.update",
    targetType: "BlogArticle",
    targetId: id,
    details: { titleFr: data.titleFr, kind: article.kind, status: articleStatus(publishedAt, now) },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const article = await prisma.blogArticle.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.blogArticle.delete({ where: { id } });

  await writeAuditLog({
    adminId: user.id,
    action: "blog_article.delete",
    targetType: "BlogArticle",
    targetId: id,
    details: { titleFr: article.titleFr, kind: article.kind },
  });

  return NextResponse.json({ ok: true });
}
