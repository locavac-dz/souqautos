import type { ArticleKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publishedNow } from "@/lib/blog-publication";
import { bucketByWeek } from "@/lib/product-stats";
import { windowDayKeys } from "@/lib/pro-stats";
import {
  RHYTHM_WEEKS,
  TARGET_DAYS,
  freshness,
  isStaleDraft,
  modelsWithoutGuide,
  type EditorialSection,
  type Freshness,
  type ModelCoverage,
} from "@/lib/editorial";
import { AI_CADENCE, AI_CADENCE_KEYS, aiCadenceStatus, type AiCadenceKey, type AiCadenceStatus, type AiStats } from "@/lib/editorial-ai-cadence";

// Lot 127 — lit en base ce qu'il faut pour le suivi du rythme éditorial (page /admin/editorial).

export type SectionSummary = {
  section: EditorialSection;
  published: number;
  lastPublishedAt: Date | null;
  scheduled: number;
  drafts: number;
  targetDays: number;
  freshness: Freshness;
};

export type ScheduledItem = { id: string; section: EditorialSection; title: string; publishedAt: Date };
export type DraftItem = { id: string; section: EditorialSection; title: string; updatedAt: Date; stale: boolean; aiGenerated: boolean };

export type AiCadenceItem = { key: AiCadenceKey; intervalDays: number; lastCreatedAt: Date | null; status: AiCadenceStatus };

export type EditorialReport = {
  sections: SectionSummary[];
  scheduled: ScheduledItem[];
  drafts: DraftItem[];
  weekly: { weekStart: Date; count: number }[];
  gaps: ModelCoverage[]; // modèles sans guide, les plus présents d'abord
  modelsOnSite: number; // modèles ayant au moins une annonce publiée
  modelsWithGuide: number;
  aiCadence: AiCadenceItem[];
  aiStats: AiStats;
};

const KIND_TO_SECTION: Record<ArticleKind, EditorialSection> = { ARTICLE: "magazine", ESSAI: "roadTests", GUIDE: "guides", EQUIPEMENT: "equipment" };
const MAX_GAPS = 15;
// Taille des listes « programmé » et « brouillons » : chaque source en lit autant, donc les LIST_LIMIT
// premiers de l'ensemble sont exacts.
const LIST_LIMIT = 20;
const POPULAR_MODELS_SCANNED = 60;
const VIEW_WINDOW_DAYS = 30;

export async function loadEditorial(now: Date = new Date()): Promise<EditorialReport> {
  const published = publishedNow(now);
  const rhythmStart = new Date(now.getTime() - RHYTHM_WEEKS * 7 * 24 * 60 * 60 * 1000);

  const [publishedByKind, scheduledByKind, draftsByKind, pressPublished, pressScheduled, pressDrafts, scheduledArticles, draftArticles, scheduledPress, draftPress, recentArticles, recentPress] = await Promise.all([
    prisma.blogArticle.groupBy({ by: ["kind"], where: published, _count: { _all: true }, _max: { publishedAt: true } }),
    prisma.blogArticle.groupBy({ by: ["kind"], where: { publishedAt: { gt: now } }, _count: { _all: true } }),
    prisma.blogArticle.groupBy({ by: ["kind"], where: { publishedAt: null }, _count: { _all: true } }),
    prisma.pressReview.aggregate({ where: published, _count: { _all: true }, _max: { publishedAt: true } }),
    prisma.pressReview.count({ where: { publishedAt: { gt: now } } }),
    prisma.pressReview.count({ where: { publishedAt: null } }),
    prisma.blogArticle.findMany({ where: { publishedAt: { gt: now } }, orderBy: { publishedAt: "asc" }, take: LIST_LIMIT, select: { id: true, kind: true, titleFr: true, publishedAt: true } }),
    prisma.blogArticle.findMany({ where: { publishedAt: null }, orderBy: { updatedAt: "asc" }, take: LIST_LIMIT, select: { id: true, kind: true, titleFr: true, updatedAt: true, aiGenerated: true } }),
    prisma.pressReview.findMany({ where: { publishedAt: { gt: now } }, orderBy: { publishedAt: "asc" }, take: LIST_LIMIT, select: { id: true, title: true, publishedAt: true } }),
    prisma.pressReview.findMany({ where: { publishedAt: null }, orderBy: { updatedAt: "asc" }, take: LIST_LIMIT, select: { id: true, title: true, updatedAt: true } }),
    prisma.blogArticle.findMany({ where: { publishedAt: { gte: rhythmStart, lte: now } }, select: { publishedAt: true } }),
    prisma.pressReview.findMany({ where: { publishedAt: { gte: rhythmStart, lte: now } }, select: { publishedAt: true } }),
  ]);

  const summary = (section: EditorialSection, count: number, last: Date | null, scheduled: number, drafts: number): SectionSummary => ({
    section,
    published: count,
    lastPublishedAt: last,
    scheduled,
    drafts,
    targetDays: TARGET_DAYS[section],
    freshness: freshness(last, TARGET_DAYS[section], now),
  });
  const kindStats = (kind: ArticleKind) => {
    const p = publishedByKind.find((g) => g.kind === kind);
    return {
      count: p?._count._all ?? 0,
      last: p?._max.publishedAt ?? null,
      scheduled: scheduledByKind.find((g) => g.kind === kind)?._count._all ?? 0,
      drafts: draftsByKind.find((g) => g.kind === kind)?._count._all ?? 0,
    };
  };
  const press = { count: pressPublished._count._all, last: pressPublished._max.publishedAt };
  const sections: SectionSummary[] = [
    summary("press", press.count, press.last, pressScheduled, pressDrafts),
    ...(["ESSAI", "ARTICLE", "GUIDE"] as const).map((kind) => {
      const s = kindStats(kind);
      return summary(KIND_TO_SECTION[kind], s.count, s.last, s.scheduled, s.drafts);
    }),
  ];

  const scheduled: ScheduledItem[] = [
    ...scheduledArticles.map((a) => ({ id: a.id, section: KIND_TO_SECTION[a.kind], title: a.titleFr, publishedAt: a.publishedAt! })),
    ...scheduledPress.map((p) => ({ id: p.id, section: "press" as const, title: p.title, publishedAt: p.publishedAt! })),
  ]
    .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime())
    .slice(0, LIST_LIMIT);

  const drafts: DraftItem[] = [
    ...draftArticles.map((a) => ({ id: a.id, section: KIND_TO_SECTION[a.kind], title: a.titleFr, updatedAt: a.updatedAt, aiGenerated: a.aiGenerated })),
    ...draftPress.map((p) => ({ id: p.id, section: "press" as const, title: p.title, updatedAt: p.updatedAt, aiGenerated: false })),
  ]
    .map((d) => ({ ...d, stale: isStaleDraft(d.updatedAt, now) }))
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
    .slice(0, LIST_LIMIT);

  const weekly = bucketByWeek([...recentArticles.map((a) => a.publishedAt!), ...recentPress.map((p) => p.publishedAt!)], RHYTHM_WEEKS, now);

  // --- lacunes : les modèles les plus présents sur le site, avec ce qui existe déjà pour chacun ---
  const popular = await prisma.listing.groupBy({
    by: ["modelId"],
    where: { status: "PUBLIEE", modelId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { modelId: "desc" } },
    take: POPULAR_MODELS_SCANNED,
  });
  const modelIds = popular.map((g) => g.modelId!).filter((id) => id !== null);
  const onSite = await prisma.listing.groupBy({ by: ["modelId"], where: { status: "PUBLIEE", modelId: { not: null } } });

  let gaps: ModelCoverage[] = [];
  let modelsWithGuide = 0;
  if (modelIds.length > 0) {
    const models = await prisma.model.findMany({ where: { id: { in: modelIds } }, select: { id: true, name: true, slug: true, brand: { select: { name: true, slug: true } } } });
    const [guideRows, essaiRows, pressRows, allGuideModels] = await Promise.all([
      prisma.buyingGuide.groupBy({ by: ["modelId"], where: { modelId: { in: modelIds }, article: published }, _count: { _all: true } }),
      prisma.roadTest.groupBy({ by: ["modelId"], where: { modelId: { in: modelIds }, article: published }, _count: { _all: true } }),
      prisma.pressReview.groupBy({ by: ["modelId"], where: { modelId: { in: modelIds }, ...published }, _count: { _all: true } }),
      prisma.buyingGuide.findMany({ where: { article: published, modelId: { in: onSite.map((g) => g.modelId!) } }, select: { modelId: true }, distinct: ["modelId"] }),
    ]);
    modelsWithGuide = allGuideModels.length;

    // Pages vues du modèle sur les 30 derniers jours (audience, Lot 124) : « marque/modèle ».
    const firstDay = new Date(`${windowDayKeys(VIEW_WINDOW_DAYS, now)[0]}T00:00:00.000Z`);
    const viewRows = await prisma.pageViewDay.groupBy({
      by: ["detail"],
      where: { page: "/voitures/[marque]/[modele]", day: { gte: firstDay }, detail: { in: models.map((m) => `${m.brand.slug}/${m.slug}`) } },
      _sum: { count: true },
    });
    const views = new Map(viewRows.map((r) => [r.detail, r._sum.count ?? 0]));
    const counts = <T extends { modelId: number | null; _count: { _all: number } }>(rows: T[]) => new Map(rows.map((r) => [r.modelId, r._count._all]));
    const guides = counts(guideRows);
    const essais = counts(essaiRows);
    const presses = counts(pressRows);
    const listingCount = new Map(popular.map((g) => [g.modelId, g._count._all]));

    const coverage: ModelCoverage[] = models.map((m) => ({
      modelId: m.id,
      brandName: m.brand.name,
      modelName: m.name,
      brandSlug: m.brand.slug,
      modelSlug: m.slug,
      listings: listingCount.get(m.id) ?? 0,
      views: views.get(`${m.brand.slug}/${m.slug}`) ?? 0,
      guides: guides.get(m.id) ?? 0,
      roadTests: essais.get(m.id) ?? 0,
      pressReviews: presses.get(m.id) ?? 0,
    }));
    gaps = modelsWithoutGuide(coverage).slice(0, MAX_GAPS);
  }

  // --- cadence et statistiques IA ---
  const [lastAiMag, lastAiPress, lastAiGuide, aiTotalGenerated, aiPendingReview, aiPublished] = await Promise.all([
    prisma.blogArticle.findFirst({ where: { aiGenerated: true, kind: "ARTICLE", slug: { startsWith: "ai-" }, NOT: { slug: { startsWith: "ai-revue-" } } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.blogArticle.findFirst({ where: { aiGenerated: true, kind: "ARTICLE", slug: { startsWith: "ai-revue-" } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.blogArticle.findFirst({ where: { aiGenerated: true, kind: "GUIDE" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.blogArticle.count({ where: { aiGenerated: true } }),
    prisma.blogArticle.count({ where: { aiGenerated: true, publishedAt: null } }),
    prisma.blogArticle.count({ where: { aiGenerated: true, ...published } }),
  ]);

  const aiCadence: AiCadenceItem[] = AI_CADENCE_KEYS.map((key) => {
    const cfg = AI_CADENCE[key];
    const lastCreatedAt = key === "magArticle" ? lastAiMag?.createdAt ?? null
      : key === "pressReview" ? lastAiPress?.createdAt ?? null
      : lastAiGuide?.createdAt ?? null;
    return { key, intervalDays: cfg.intervalDays, lastCreatedAt, status: aiCadenceStatus(lastCreatedAt, cfg.intervalDays, now) };
  });

  const aiStats: AiStats = { totalGenerated: aiTotalGenerated, pendingReview: aiPendingReview, published: aiPublished };

  return { sections, scheduled, drafts, weekly, gaps, modelsOnSite: onSite.length, modelsWithGuide, aiCadence, aiStats };
}
