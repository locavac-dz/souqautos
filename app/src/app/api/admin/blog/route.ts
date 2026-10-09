import { NextRequest, NextResponse } from "next/server";
import { requireRole, parseJsonBody } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { isEditor } from "@/lib/auth-server/roles";
import { blogArticleSchema } from "@/lib/validation/blog";
import { slugify } from "@/lib/slugify";
import { generateUniqueSlug, RESERVED_SLUGS } from "@/lib/blog";
import { articleStatus, resolvePublishedAt } from "@/lib/blog-publication";
import { toRoadTestData } from "@/lib/road-test-data";
import { toBuyingGuideData } from "@/lib/buying-guide";
import { validateVehicleRefs } from "@/lib/listing-catalogue-refs";
import { isBlogCoverUrl } from "@/lib/blog-cover";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { resolveSource } from "@/lib/blog-source";
import { writeAuditLog } from "@/lib/audit-log";

// Réservé à ADMIN : le blog est un contenu public engageant l'image de la
// marque, pas une action de modération courante — même seuil que la gestion
// du référentiel marques/modèles.
export async function POST(request: NextRequest) {
  const user = await requireRole(isEditor);
  if (user instanceof NextResponse) return user;

  const body = await parseJsonBody(request, blogArticleSchema);
  if (body instanceof NextResponse) return body;
  const data = body;

  // Lot 115 — source facultative (nom + lien https normalisé).
  const source = resolveSource(data);
  if (!source.ok) {
    return NextResponse.json({ error: source.error }, { status: 400 });
  }

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


  // Lot 126 — guide d'achat.
  let guideBrandId: number | null | undefined;
  // Lot 144 — sans modèle, le guide est GÉNÉRAL (« acheter une voiture d'occasion ») : aucune marque non plus. Avec un modèle
  // (Lot 126), la marque se déduit de lui — jamais lue du navigateur — et la génération, si elle est donnée, doit lui appartenir.
  const guideModelId = data.guide?.modelId;
  if (data.guide && guideModelId === undefined) {
    guideBrandId = null;
  } else if (data.guide && guideModelId !== undefined) {
    const guideModel = await prisma.model.findUnique({ where: { id: guideModelId }, select: { brandId: true } });
    if (!guideModel) {
      return NextResponse.json({ error: "unknown_model" }, { status: 400 });
    }
    const guideRefs = await validateVehicleRefs({ brandId: guideModel.brandId, modelId: guideModelId, generationId: data.guide.generationId });
    if (!guideRefs.ok) {
      return NextResponse.json({ error: guideRefs.error }, { status: 400 });
    }
    guideBrandId = guideModel.brandId;
  }

  const existingSlugs = (await prisma.blogArticle.findMany({ select: { slug: true }, take: 500 })).map(
    (a) => a.slug
  );
  // `revue-de-presse` est une page fixe de /essais : un essai qui porterait ce
  // slug serait masqué par elle.
  const slug = generateUniqueSlug(slugify(data.titleFr), [...existingSlugs, ...RESERVED_SLUGS]);

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
        sourceName: source.sourceName,
        sourceUrl: source.sourceUrl,
        publishedAt,
        roadTest: data.roadTest ? { create: toRoadTestData(data.roadTest, brandIdFromModel) } : undefined,
        guide: data.guide && guideBrandId !== undefined ? { create: toBuyingGuideData(data.guide, guideBrandId) } : undefined,
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
