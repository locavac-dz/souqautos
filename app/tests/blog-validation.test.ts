import { describe, expect, it } from "vitest";
import { blogArticleSchema } from "@/lib/validation/blog";

const text = (n: number) => "x".repeat(n);
const articleBase = {
  titleFr: "Titre en français",
  titleAr: "عنوان بالعربية طويل",
  excerptFr: text(30),
  excerptAr: text(30),
  contentFr: text(120),
  contentAr: text(120),
};
const roadTest = {
  rating: 3.5,
  prosFr: "Confort\nPrix",
  prosAr: "راحة\nسعر",
  consFr: "Coffre",
  consAr: "صندوق",
  verdictFr: "Une compacte confortable et bien équipée.",
  verdictAr: "سيارة مريحة ومجهزة جيدا للغاية.",
};

describe("blogArticleSchema", () => {
  it("treats an article without kind as a simple article saved as a draft", () => {
    const result = blogArticleSchema.parse(articleBase);
    expect(result.kind).toBe("ARTICLE");
    expect(result.publication).toEqual({ mode: "draft" });
  });

  it("requires the road-test sheet for an essai", () => {
    expect(blogArticleSchema.safeParse({ ...articleBase, kind: "ESSAI" }).success).toBe(false);
    expect(blogArticleSchema.safeParse({ ...articleBase, kind: "ESSAI", roadTest }).success).toBe(true);
  });

  it("forbids a road-test sheet on a simple article", () => {
    expect(blogArticleSchema.safeParse({ ...articleBase, kind: "ARTICLE", roadTest }).success).toBe(false);
  });

  it("rejects a rating that is not a half-point step or out of range", () => {
    for (const rating of [0, 3.3, 5.5]) {
      expect(blogArticleSchema.safeParse({ ...articleBase, kind: "ESSAI", roadTest: { ...roadTest, rating } }).success).toBe(false);
    }
  });

  it("rejects empty or oversized pros/cons lists", () => {
    const tooMany = Array.from({ length: 9 }, (_, i) => `Point ${i}`).join("\n");
    expect(blogArticleSchema.safeParse({ ...articleBase, kind: "ESSAI", roadTest: { ...roadTest, prosFr: "" } }).success).toBe(false);
    expect(blogArticleSchema.safeParse({ ...articleBase, kind: "ESSAI", roadTest: { ...roadTest, consAr: tooMany } }).success).toBe(false);
  });

  it("accepts the three publication choices and rejects an invalid schedule date", () => {
    for (const publication of [{ mode: "draft" }, { mode: "now" }, { mode: "scheduled", at: "2026-10-01T08:00:00Z" }]) {
      expect(blogArticleSchema.safeParse({ ...articleBase, publication }).success).toBe(true);
    }
    expect(blogArticleSchema.safeParse({ ...articleBase, publication: { mode: "scheduled", at: "demain" } }).success).toBe(false);
    expect(blogArticleSchema.safeParse({ ...articleBase, publication: { mode: "scheduled" } }).success).toBe(false);
  });

  it("caps catalogue ids at the 32-bit range", () => {
    const tooBig = { ...roadTest, modelId: 2_147_483_648 };
    expect(blogArticleSchema.safeParse({ ...articleBase, kind: "ESSAI", roadTest: tooBig }).success).toBe(false);
  });

  it("accepts a cover on an essai, or none (absent or null)", () => {
    const cover = "/uploads/blog-covers/0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d.jpg";
    expect(blogArticleSchema.safeParse({ ...articleBase, kind: "ESSAI", roadTest, coverImageUrl: cover }).success).toBe(true);
    expect(blogArticleSchema.safeParse({ ...articleBase, kind: "ESSAI", roadTest, coverImageUrl: null }).success).toBe(true);
    expect(blogArticleSchema.safeParse({ ...articleBase, kind: "ESSAI", roadTest }).success).toBe(true);
  });

  it("refuses a cover on a simple article (only essais have one)", () => {
    const cover = "/uploads/blog-covers/0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d.jpg";
    expect(blogArticleSchema.safeParse({ ...articleBase, coverImageUrl: cover }).success).toBe(false);
    expect(blogArticleSchema.safeParse({ ...articleBase, coverImageUrl: null }).success).toBe(true);
  });
});
