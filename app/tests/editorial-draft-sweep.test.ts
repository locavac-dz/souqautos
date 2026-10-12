import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    blogArticle: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    buyingGuide: { findMany: vi.fn() },
    listing: { groupBy: vi.fn() },
    model: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/editorial-ai-writer", () => ({
  generateMagArticleDraft: vi.fn(),
  generateBuyingGuideDraft: vi.fn(),
  generatePressReviewDraft: vi.fn(),
}));

vi.mock("@/lib/editorial-topics", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/editorial-topics")>();
  return { ...original, pickNextTopic: vi.fn().mockReturnValue({ key: "test-topic", promptFr: "Un prompt de test." }) };
});

vi.mock("@/lib/editorial-press-topics", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/editorial-press-topics")>();
  return { ...original, pickNextPressReviewTopic: vi.fn().mockReturnValue({ key: "test-press", promptFr: "Un prompt presse." }) };
});

vi.mock("@/lib/blog", () => ({
  generateUniqueSlug: vi.fn((base: string) => base),
  RESERVED_SLUGS: [],
}));

vi.mock("@/lib/slugify", () => ({
  slugify: vi.fn((s: string) => s.toLowerCase().replace(/\s+/g, "-")),
}));

import { prisma } from "@/lib/prisma";
import { generateMagArticleDraft, generateBuyingGuideDraft, generatePressReviewDraft } from "@/lib/editorial-ai-writer";
import { sweepEditorialDrafts } from "@/lib/editorial-draft-sweep";

const mockedPrisma = vi.mocked(prisma, true);
const mockedGenArticle = vi.mocked(generateMagArticleDraft);
const mockedGenGuide = vi.mocked(generateBuyingGuideDraft);
const mockedGenPressReview = vi.mocked(generatePressReviewDraft);

const NOW = new Date("2026-10-12T08:00:00Z");
const DRAFT = { titleFr: "T", titleAr: "ع", excerptFr: "E", excerptAr: "م", contentFr: "C", contentAr: "م" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
});

function mockAllDueChecksRecent() {
  mockedPrisma.blogArticle.findFirst
    .mockResolvedValueOnce({ id: "recent-mag" } as never)
    .mockResolvedValueOnce({ id: "recent-press" } as never)
    .mockResolvedValueOnce({ id: "recent-guide" } as never);
}

function mockAllDueChecksNone() {
  mockedPrisma.blogArticle.findFirst
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(null);
}

describe("sweepEditorialDrafts", () => {
  it("returns nulls when ANTHROPIC_API_KEY is missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const result = await sweepEditorialDrafts(NOW);
    expect(result).toEqual({ articleDraft: null, pressReviewDraft: null, guideDraft: null });
  });

  it("returns nulls when no admin user exists", async () => {
    mockedPrisma.user.findFirst.mockResolvedValueOnce(null);
    const result = await sweepEditorialDrafts(NOW);
    expect(result).toEqual({ articleDraft: null, pressReviewDraft: null, guideDraft: null });
  });

  it("skips article generation when a recent AI mag article exists", async () => {
    mockedPrisma.user.findFirst.mockResolvedValueOnce({ id: "admin-1" } as never);
    mockAllDueChecksRecent();

    const result = await sweepEditorialDrafts(NOW);
    expect(mockedGenArticle).not.toHaveBeenCalled();
    expect(mockedGenPressReview).not.toHaveBeenCalled();
    expect(result.articleDraft).toBeNull();
    expect(result.pressReviewDraft).toBeNull();
  });

  it("generates a mag article when none exists within 7 days", async () => {
    mockedPrisma.user.findFirst.mockResolvedValueOnce({ id: "admin-1" } as never);
    mockedPrisma.blogArticle.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "recent-press" } as never)
      .mockResolvedValueOnce({ id: "recent-guide" } as never);
    mockedPrisma.blogArticle.findMany.mockResolvedValue([]);
    mockedGenArticle.mockResolvedValueOnce(DRAFT);
    mockedPrisma.blogArticle.create.mockResolvedValueOnce({ id: "new-1", slug: "ai-test-topic" } as never);

    const result = await sweepEditorialDrafts(NOW);
    expect(mockedGenArticle).toHaveBeenCalledOnce();
    expect(mockedPrisma.blogArticle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ aiGenerated: true, publishedAt: null, kind: "ARTICLE" }),
      }),
    );
    expect(result.articleDraft).toBe("ai-test-topic");
  });

  it("generates a press review when none exists within 7 days", async () => {
    mockedPrisma.user.findFirst.mockResolvedValueOnce({ id: "admin-1" } as never);
    mockedPrisma.blogArticle.findFirst
      .mockResolvedValueOnce({ id: "recent-mag" } as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "recent-guide" } as never);
    mockedPrisma.blogArticle.findMany.mockResolvedValue([]);
    mockedGenPressReview.mockResolvedValueOnce(DRAFT);
    mockedPrisma.blogArticle.create.mockResolvedValueOnce({ id: "new-pr", slug: "ai-revue-test-press" } as never);

    const result = await sweepEditorialDrafts(NOW);
    expect(mockedGenPressReview).toHaveBeenCalledOnce();
    expect(result.pressReviewDraft).toBe("ai-revue-test-press");
  });

  it("generates a guide for the most popular model without one", async () => {
    mockedPrisma.user.findFirst.mockResolvedValueOnce({ id: "admin-1" } as never);
    mockedPrisma.blogArticle.findFirst
      .mockResolvedValueOnce({ id: "recent-mag" } as never)
      .mockResolvedValueOnce({ id: "recent-press" } as never)
      .mockResolvedValueOnce(null);

    mockedPrisma.listing.groupBy.mockResolvedValueOnce([
      { modelId: "model-a", _count: { _all: 50 }, _avg: { price: 2000000 } },
      { modelId: "model-b", _count: { _all: 30 }, _avg: { price: 1500000 } },
    ]);
    mockedPrisma.buyingGuide.findMany.mockResolvedValueOnce([{ modelId: 1 }] as never);
    mockedPrisma.model.findUnique.mockResolvedValueOnce({
      id: "model-b",
      name: "Sandero",
      brand: { id: "brand-1", name: "Dacia" },
    } as never);
    mockedPrisma.blogArticle.findMany.mockResolvedValue([]);
    mockedGenGuide.mockResolvedValueOnce({
      ...DRAFT,
      guide: {
        checklistFr: "Point 1\nPoint 2",
        checklistAr: "نقطة 1\nنقطة 2",
        adviceFr: "Bon choix pour un premier véhicule.",
        adviceAr: "خيار جيد كسيارة أولى.",
      },
    });
    mockedPrisma.blogArticle.create.mockResolvedValueOnce({ id: "new-2", slug: "ai-guide-dacia-sandero" } as never);

    const result = await sweepEditorialDrafts(NOW);
    expect(mockedGenGuide).toHaveBeenCalledWith(expect.objectContaining({ brandName: "Dacia", modelName: "Sandero" }));
    expect(result.guideDraft).toBe("ai-guide-dacia-sandero");
  });

  it("skips guide when no uncovered model exists", async () => {
    mockedPrisma.user.findFirst.mockResolvedValueOnce({ id: "admin-1" } as never);
    mockedPrisma.blogArticle.findFirst
      .mockResolvedValueOnce({ id: "recent-mag" } as never)
      .mockResolvedValueOnce({ id: "recent-press" } as never)
      .mockResolvedValueOnce(null);
    mockedPrisma.listing.groupBy.mockResolvedValueOnce([
      { modelId: "model-a", _count: { _all: 50 }, _avg: { price: 2000000 } },
    ]);
    mockedPrisma.buyingGuide.findMany.mockResolvedValueOnce([{ modelId: 1 }] as never);

    const result = await sweepEditorialDrafts(NOW);
    expect(mockedGenGuide).not.toHaveBeenCalled();
    expect(result.guideDraft).toBeNull();
  });

  it("generates both article and press review when both are due", async () => {
    mockedPrisma.user.findFirst.mockResolvedValueOnce({ id: "admin-1" } as never);
    mockedPrisma.blogArticle.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "recent-guide" } as never);
    mockedPrisma.blogArticle.findMany.mockResolvedValue([]);
    mockedGenArticle.mockResolvedValueOnce(DRAFT);
    mockedGenPressReview.mockResolvedValueOnce(DRAFT);
    mockedPrisma.blogArticle.create
      .mockResolvedValueOnce({ id: "new-mag", slug: "ai-test-topic" } as never)
      .mockResolvedValueOnce({ id: "new-pr", slug: "ai-revue-test-press" } as never);

    const result = await sweepEditorialDrafts(NOW);
    expect(mockedGenArticle).toHaveBeenCalledOnce();
    expect(mockedGenPressReview).toHaveBeenCalledOnce();
    expect(result.articleDraft).toBe("ai-test-topic");
    expect(result.pressReviewDraft).toBe("ai-revue-test-press");
  });
});
