import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { generateUniqueSlug, RESERVED_SLUGS } from "@/lib/blog";
import { generateMagArticleDraft, generateBuyingGuideDraft } from "@/lib/editorial-ai-writer";
import { pickNextTopic, MAG_TOPIC_TEMPLATES } from "@/lib/editorial-topics";

const ARTICLE_INTERVAL_DAYS = 7;
const GUIDE_INTERVAL_DAYS = 30;

export type EditorialDraftResult = {
  articleDraft: string | null;
  guideDraft: string | null;
};

export async function sweepEditorialDrafts(now: Date): Promise<EditorialDraftResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { articleDraft: null, guideDraft: null };
  }

  const botUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!botUser) return { articleDraft: null, guideDraft: null };

  const result: EditorialDraftResult = { articleDraft: null, guideDraft: null };

  const articleDue = await isDraftDue("ARTICLE", ARTICLE_INTERVAL_DAYS, now);
  if (articleDue) {
    result.articleDraft = await tryGenerateArticle(botUser.id, now);
  }

  const guideDue = await isDraftDue("GUIDE", GUIDE_INTERVAL_DAYS, now);
  if (guideDue) {
    result.guideDraft = await tryGenerateGuide(botUser.id, now);
  }

  return result;
}

async function isDraftDue(kind: "ARTICLE" | "GUIDE", intervalDays: number, now: Date): Promise<boolean> {
  const cutoff = new Date(now.getTime() - intervalDays * 24 * 60 * 60 * 1000);
  const recent = await prisma.blogArticle.findFirst({
    where: { kind, aiGenerated: true, createdAt: { gte: cutoff } },
    select: { id: true },
  });
  return !recent;
}

async function tryGenerateArticle(authorId: string, now: Date): Promise<string | null> {
  try {
    const recentAiArticles = await prisma.blogArticle.findMany({
      where: { kind: "ARTICLE", aiGenerated: true },
      orderBy: { createdAt: "desc" },
      take: MAG_TOPIC_TEMPLATES.length,
      select: { slug: true },
    });
    const recentKeys = recentAiArticles.map((a) => a.slug.replace(/^ai-/, "").replace(/-\d+$/, ""));
    const topic = pickNextTopic(recentKeys);

    const draft = await generateMagArticleDraft(topic);
    if (!draft) {
      console.error("[editorial-sweep] échec génération article IA");
      return null;
    }

    const existingSlugs = (await prisma.blogArticle.findMany({ select: { slug: true }, take: 500 })).map((a) => a.slug);
    const slug = generateUniqueSlug(`ai-${slugify(topic.key)}`, [...existingSlugs, ...RESERVED_SLUGS]);

    const article = await prisma.blogArticle.create({
      data: {
        slug,
        kind: "ARTICLE",
        titleFr: draft.titleFr,
        titleAr: draft.titleAr,
        excerptFr: draft.excerptFr,
        excerptAr: draft.excerptAr,
        contentFr: draft.contentFr,
        contentAr: draft.contentAr,
        authorId,
        aiGenerated: true,
        publishedAt: null,
      },
      select: { id: true, slug: true },
    });

    console.log(`[editorial-sweep] brouillon article IA créé : ${article.slug}`);
    return article.slug;
  } catch (err) {
    console.error(`[editorial-sweep] erreur article : ${(err as Error).message}`);
    return null;
  }
}

async function tryGenerateGuide(authorId: string, now: Date): Promise<string | null> {
  try {
    const popular = await prisma.listing.groupBy({
      by: ["modelId"],
      where: { status: "PUBLIEE", modelId: { not: null } },
      _count: { _all: true },
      _avg: { price: true },
      orderBy: { _count: { modelId: "desc" } },
      take: 30,
    });

    const modelIds = popular.map((g) => g.modelId!).filter(Boolean);
    if (modelIds.length === 0) return null;

    const existingGuides = await prisma.buyingGuide.findMany({
      where: { modelId: { in: modelIds } },
      select: { modelId: true },
    });
    const coveredIds = new Set(existingGuides.map((g) => g.modelId));

    const uncovered = popular.filter((g) => g.modelId && !coveredIds.has(g.modelId));
    if (uncovered.length === 0) return null;

    const target = uncovered[0];
    const model = await prisma.model.findUnique({
      where: { id: target.modelId! },
      select: { id: true, name: true, brand: { select: { id: true, name: true } } },
    });
    if (!model) return null;

    const draft = await generateBuyingGuideDraft({
      brandName: model.brand.name,
      modelName: model.name,
      listingCount: target._count._all,
      avgPrice: target._avg.price ? Math.round(target._avg.price) : undefined,
    });
    if (!draft) {
      console.error("[editorial-sweep] échec génération guide IA");
      return null;
    }

    const existingSlugs = (await prisma.blogArticle.findMany({ select: { slug: true }, take: 500 })).map((a) => a.slug);
    const slug = generateUniqueSlug(`ai-guide-${slugify(model.brand.name)}-${slugify(model.name)}`, [...existingSlugs, ...RESERVED_SLUGS]);

    const article = await prisma.blogArticle.create({
      data: {
        slug,
        kind: "GUIDE",
        titleFr: draft.titleFr,
        titleAr: draft.titleAr,
        excerptFr: draft.excerptFr,
        excerptAr: draft.excerptAr,
        contentFr: draft.contentFr,
        contentAr: draft.contentAr,
        authorId,
        aiGenerated: true,
        publishedAt: null,
        guide: {
          create: {
            brandId: model.brand.id,
            modelId: model.id,
            checklistFr: draft.guide.checklistFr,
            checklistAr: draft.guide.checklistAr,
            adviceFr: draft.guide.adviceFr,
            adviceAr: draft.guide.adviceAr,
          },
        },
      },
      select: { id: true, slug: true },
    });

    console.log(`[editorial-sweep] brouillon guide IA créé : ${article.slug}`);
    return article.slug;
  } catch (err) {
    console.error(`[editorial-sweep] erreur guide : ${(err as Error).message}`);
    return null;
  }
}
