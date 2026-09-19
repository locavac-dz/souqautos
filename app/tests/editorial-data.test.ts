import { beforeEach, describe, expect, it, vi } from "vitest";

const m = {
  articleGroupBy: vi.fn(),
  articleFindMany: vi.fn(),
  pressAggregate: vi.fn(),
  pressCount: vi.fn(),
  pressFindMany: vi.fn(),
  listingGroupBy: vi.fn(),
  modelFindMany: vi.fn(),
  guideGroupBy: vi.fn(),
  guideFindMany: vi.fn(),
  roadTestGroupBy: vi.fn(),
  pressGroupBy: vi.fn(),
  viewGroupBy: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    blogArticle: { groupBy: (...a: unknown[]) => m.articleGroupBy(...a), findMany: (...a: unknown[]) => m.articleFindMany(...a) },
    pressReview: { aggregate: (...a: unknown[]) => m.pressAggregate(...a), count: (...a: unknown[]) => m.pressCount(...a), findMany: (...a: unknown[]) => m.pressFindMany(...a), groupBy: (...a: unknown[]) => m.pressGroupBy(...a) },
    listing: { groupBy: (...a: unknown[]) => m.listingGroupBy(...a) },
    model: { findMany: (...a: unknown[]) => m.modelFindMany(...a) },
    buyingGuide: { groupBy: (...a: unknown[]) => m.guideGroupBy(...a), findMany: (...a: unknown[]) => m.guideFindMany(...a) },
    roadTest: { groupBy: (...a: unknown[]) => m.roadTestGroupBy(...a) },
    pageViewDay: { groupBy: (...a: unknown[]) => m.viewGroupBy(...a) },
  },
}));

import { loadEditorial } from "@/lib/editorial-data";

const NOW = new Date("2026-09-19T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000);
const inDays = (n: number) => new Date(NOW.getTime() + n * 86400000);

beforeEach(() => {
  vi.resetAllMocks();

  // publiés / programmés / brouillons par type (dans cet ordre d'appel : publiés, programmés, brouillons)
  m.articleGroupBy.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    if ("lte" in ((where.publishedAt as object) ?? {})) return [{ kind: "ARTICLE", _count: { _all: 5 }, _max: { publishedAt: daysAgo(40) } }, { kind: "ESSAI", _count: { _all: 2 }, _max: { publishedAt: daysAgo(10) } }];
    if ("gt" in ((where.publishedAt as object) ?? {})) return [{ kind: "GUIDE", _count: { _all: 1 } }];
    return [{ kind: "GUIDE", _count: { _all: 2 } }]; // brouillons
  });
  m.pressAggregate.mockResolvedValue({ _count: { _all: 8 }, _max: { publishedAt: daysAgo(3) } });
  m.pressCount.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => ("gt" in ((where.publishedAt as object) ?? {}) ? 1 : 4));
  m.articleFindMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    const p = where.publishedAt as Record<string, unknown> | null;
    if (p && "gt" in p) return [{ id: "a-sched", kind: "GUIDE", titleFr: "Guide programmé", publishedAt: inDays(4) }];
    if (p === null) return [{ id: "a-draft", kind: "ARTICLE", titleFr: "Vieux brouillon", updatedAt: daysAgo(30) }, { id: "a-draft2", kind: "GUIDE", titleFr: "Brouillon récent", updatedAt: daysAgo(2) }];
    return [{ publishedAt: daysAgo(3) }, { publishedAt: daysAgo(10) }];
  });
  m.pressFindMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    const p = where.publishedAt as Record<string, unknown> | null;
    if (p && "gt" in p) return [{ id: "p-sched", title: "Revue programmée", publishedAt: inDays(1) }];
    if (p === null) return [{ id: "p-draft", title: "Revue en brouillon", updatedAt: daysAgo(20) }];
    return [{ publishedAt: daysAgo(3) }];
  });

  m.listingGroupBy.mockImplementation(async ({ by }: { by: string[]; take?: number }) => (by.length === 1 && "take" in (m.listingGroupBy.mock.calls.at(-1)?.[0] ?? {}) ? [{ modelId: 1, _count: { _all: 9 } }, { modelId: 2, _count: { _all: 4 } }, { modelId: 3, _count: { _all: 1 } }] : [{ modelId: 1 }, { modelId: 2 }, { modelId: 3 }, { modelId: 4 }]));
  m.modelFindMany.mockResolvedValue([
    { id: 1, name: "Clio", slug: "clio", brand: { name: "Renault", slug: "renault" } },
    { id: 2, name: "Duster", slug: "duster", brand: { name: "Dacia", slug: "dacia" } },
    { id: 3, name: "208", slug: "208", brand: { name: "Peugeot", slug: "peugeot" } },
  ]);
  m.guideGroupBy.mockResolvedValue([{ modelId: 2, _count: { _all: 1 } }]); // la Duster a un guide
  m.guideFindMany.mockResolvedValue([{ modelId: 2 }]);
  m.roadTestGroupBy.mockResolvedValue([{ modelId: 1, _count: { _all: 2 } }]);
  m.pressGroupBy.mockResolvedValue([{ modelId: 3, _count: { _all: 1 } }]);
  m.viewGroupBy.mockResolvedValue([{ detail: "renault/clio", _sum: { count: 120 } }, { detail: "peugeot/208", _sum: { count: 30 } }]);
});

describe("loadEditorial", () => {
  it("summarises every section with its last publication, counts and freshness against its target", async () => {
    const report = await loadEditorial(NOW);
    const by = Object.fromEntries(report.sections.map((s) => [s.section, s]));
    expect(report.sections.map((s) => s.section)).toEqual(["press", "roadTests", "magazine", "guides"]);
    expect(by.press).toMatchObject({ published: 8, scheduled: 1, drafts: 4, targetDays: 7, freshness: { status: "ok", daysSince: 3 } });
    expect(by.roadTests).toMatchObject({ published: 2, freshness: { status: "ok", daysSince: 10 } });
    expect(by.magazine).toMatchObject({ published: 5, targetDays: 30, freshness: { status: "late", daysSince: 40, overdueBy: 10 } });
    expect(by.guides).toMatchObject({ published: 0, scheduled: 1, drafts: 2, freshness: { status: "empty" } });
  });

  it("lists what is scheduled soonest first, across articles and press reviews", async () => {
    const report = await loadEditorial(NOW);
    expect(report.scheduled.map((s) => `${s.section}:${s.title}`)).toEqual(["press:Revue programmée", "guides:Guide programmé"]);
  });

  it("lists drafts oldest first and flags the forgotten ones", async () => {
    const report = await loadEditorial(NOW);
    expect(report.drafts.map((d) => [d.title, d.stale])).toEqual([
      ["Vieux brouillon", true],
      ["Revue en brouillon", true],
      ["Brouillon récent", false],
    ]);
  });

  it("counts publications per week over 12 weeks, articles and press reviews together", async () => {
    const report = await loadEditorial(NOW);
    expect(report.weekly).toHaveLength(12);
    expect(report.weekly.reduce((s, w) => s + w.count, 0)).toBe(3); // 2 articles + 1 revue
  });

  it("shows models that lack a guide, the most present first, with what already exists for them", async () => {
    const report = await loadEditorial(NOW);
    expect(report.gaps.map((g) => g.modelName)).toEqual(["Clio", "208"]); // la Duster a déjà un guide
    expect(report.gaps[0]).toMatchObject({ modelId: 1, listings: 9, views: 120, roadTests: 2, pressReviews: 0, guides: 0 });
    expect(report.gaps[1]).toMatchObject({ listings: 1, views: 30, pressReviews: 1 });
  });

  it("measures the coverage on the models that have at least one published listing", async () => {
    const report = await loadEditorial(NOW);
    expect(report.modelsOnSite).toBe(4);
    expect(report.modelsWithGuide).toBe(1);
  });

  it("counts a guide only when published (the query filters on the article's publication date)", async () => {
    await loadEditorial(NOW);
    expect(m.guideGroupBy.mock.calls[0][0].where.article).toEqual({ publishedAt: { lte: NOW } });
    expect(m.roadTestGroupBy.mock.calls[0][0].where.article).toEqual({ publishedAt: { lte: NOW } });
    expect(m.pressGroupBy.mock.calls[0][0].where).toMatchObject({ publishedAt: { lte: NOW } });
  });

  it("reads the model's page views only over the last 30 days and only for the model page", async () => {
    await loadEditorial(NOW);
    const where = m.viewGroupBy.mock.calls[0][0].where;
    expect(where.page).toBe("/voitures/[marque]/[modele]");
    expect(where.day).toEqual({ gte: new Date("2026-08-21T00:00:00.000Z") });
  });

  it("copes with a site that has no listing at all", async () => {
    m.listingGroupBy.mockResolvedValue([]);
    const report = await loadEditorial(NOW);
    expect(report).toMatchObject({ gaps: [], modelsOnSite: 0, modelsWithGuide: 0 });
    expect(m.modelFindMany).not.toHaveBeenCalled();
  });
});
