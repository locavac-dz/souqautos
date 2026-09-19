import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { blogArticleSchema } from "@/lib/validation/blog";
import { slugify } from "@/lib/slugify";
import { generateUniqueSlug } from "@/lib/blog";
import { articleStatus, resolvePublishedAt } from "@/lib/blog-publication";
import { toRoadTestData } from "@/lib/road-test-data";
import { validateVehicleRefs } from "@/lib/listing-catalogue-refs";
import { isBlogCoverUrl } from "@/lib/blog-cover";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { writeAuditLog } from "@/lib/audit-log";

// Réservé à ADMIN : le blog est un contenu public engageant l'image de la
// marque, pas une action de modération courante — même seuil que la gestion
// du référentiel marques/modèles.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = blogArticleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }
  const data = parsed.data;

  // Lot 111 — la couverture doit être un fichier issu de /api/admin/blog/cover.
  if (data.coverImageUrl && !isBlogCoverUrl(data.coverImageUrl, process.env.S3_PUBLIC_URL)) {
    return NextResponse.json({ error: "invalid_cover" }, { status: 400 });
  }

  // Lot 110 — marque/modèle/génération d'un essai : jamais un identifiant
  // fabriqué côté client accepté tel quel. La marque se déduit du modèle choisi.
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

  const existingSlugs = (await prisma.blogArticle.findMany({ select: { slug: true } })).map(
    (a) => a.slug
  );
  const slug = generateUniqueSlug(slugify(data.titleFr), existingSlugs);

  const now = new Date();
  const publishedAt = resolvePublishedAt(data.publication, null, now);

  let article;
  try {
    article = await prisma.blogArticle.create({
      data: {
        slug,
        kind: data.kind,
        titleFr: data.titleFr,
        titleAr: data.titleAr,
        excerptFr: data.excerptFr,
        excerptAr: data.excerptAr,
        contentFr: data.contentFr,
        contentAr: data.contentAr,
        authorId: user.id,
        coverImageUrl: data.coverImageUrl || null,
        publishedAt,
        roadTest: data.roadTest ? { create: toRoadTestData(data.roadTest, brandIdFromModel) } : undefined,
      },
      select: { id: true, slug: true },
    });
  } catch (error) {
    // Deux articles au même titre créés en même temps : le slug (adresse
    // publique) est unique, la base n'en retient qu'un.
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }
    throw error;
  }

  await writeAuditLog({
    adminId: user.id,
    action: "blog_article.create",
    targetType: "BlogArticle",
    targetId: article.id,
    details: { titleFr: data.titleFr, kind: data.kind, status: articleStatus(publishedAt, now) },
  });

  return NextResponse.json({ article }, { status: 201 });
}
