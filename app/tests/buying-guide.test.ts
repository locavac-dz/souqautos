import { describe, expect, it } from "vitest";
import { MAX_CHECKLIST_ITEMS, MAX_CHECKLIST_ITEM_LENGTH, isValidChecklist, toBuyingGuideData } from "@/lib/buying-guide";
import { articleAdminSection, articlePublicPath } from "@/lib/blog";
import { blogArticleSchema, guideSchema } from "@/lib/validation/blog";

const text = (n: number) => "x".repeat(n);
const lines = (n: number) => Array.from({ length: n }, (_, i) => `Point ${i + 1}`).join("\n");

const guide = {
  modelId: 12,
  checklistFr: "Historique d'entretien complet\nTraces de rouille sous le châssis",
  checklistAr: "سجل الصيانة كامل\nآثار صدأ أسفل الهيكل",
  adviceFr: "Préférez un exemplaire dont l'entretien est documenté.",
  adviceAr: "فضّل سيارة صيانتها موثقة بالفواتير والسجلات.",
};
const base = {
  titleFr: "Acheter une Clio 4 d'occasion",
  titleAr: "شراء رونو كليو 4 مستعملة",
  excerptFr: "Ce qu'il faut vérifier avant d'acheter une Clio 4 d'occasion.",
  excerptAr: "ما يجب فحصه قبل شراء كليو 4 مستعملة من السوق.",
  contentFr: text(120),
  contentAr: text(120),
};

describe("isValidChecklist", () => {
  it("accepts 1 to 12 lines of at most 200 characters", () => {
    expect(isValidChecklist("un seul point")).toBe(true);
    expect(isValidChecklist(lines(MAX_CHECKLIST_ITEMS))).toBe(true);
    expect(isValidChecklist(text(MAX_CHECKLIST_ITEM_LENGTH))).toBe(true);
  });

  it("refuses an empty list, too many points, or a point that is too long", () => {
    expect(isValidChecklist("")).toBe(false);
    expect(isValidChecklist("  \n \n")).toBe(false);
    expect(isValidChecklist(lines(MAX_CHECKLIST_ITEMS + 1))).toBe(false);
    expect(isValidChecklist(text(MAX_CHECKLIST_ITEM_LENGTH + 1))).toBe(false);
  });

  it("does not count blank lines as points", () => {
    expect(isValidChecklist(`${lines(MAX_CHECKLIST_ITEMS)}\n\n   \n`)).toBe(true);
  });
});

describe("toBuyingGuideData", () => {
  it("normalises the lists and takes the brand from the model, never from the input", () => {
    const parsed = guideSchema.parse({ ...guide, checklistFr: "  a  \n\n b \r\n c", generationId: 3 });
    expect(toBuyingGuideData(parsed, 7)).toEqual({
      brandId: 7,
      modelId: 12,
      generationId: 3,
      checklistFr: "a\nb\nc",
      checklistAr: "سجل الصيانة كامل\nآثار صدأ أسفل الهيكل",
      adviceFr: guide.adviceFr,
      adviceAr: guide.adviceAr,
    });
  });

  it("leaves the generation empty when none is chosen", () => {
    expect(toBuyingGuideData(guideSchema.parse(guide), 7).generationId).toBeNull();
  });
});

describe("guideSchema", () => {
  it("requires the model (that is what links a guide to its model page and its listings)", () => {
    const { modelId, ...withoutModel } = guide;
    void modelId;
    expect(guideSchema.safeParse(withoutModel).success).toBe(false);
    expect(guideSchema.safeParse({ ...guide, modelId: 0 }).success).toBe(false);
    expect(guideSchema.safeParse({ ...guide, modelId: -3 }).success).toBe(false);
    expect(guideSchema.safeParse({ ...guide, modelId: 1.5 }).success).toBe(false);
    expect(guideSchema.safeParse({ ...guide, modelId: 99999999999 }).success).toBe(false); // au-delà d'un entier 32 bits
  });

  it("requires both languages for the checklist and the advice", () => {
    for (const field of ["checklistFr", "checklistAr", "adviceFr", "adviceAr"] as const) {
      expect(guideSchema.safeParse({ ...guide, [field]: "" }).success, field).toBe(false);
    }
  });

  it("bounds the advice to 20–400 characters", () => {
    expect(guideSchema.safeParse({ ...guide, adviceFr: text(19) }).success).toBe(false);
    expect(guideSchema.safeParse({ ...guide, adviceFr: text(400) }).success).toBe(true);
    expect(guideSchema.safeParse({ ...guide, adviceAr: text(401) }).success).toBe(false);
  });
});

describe("blogArticleSchema — guides", () => {
  it("accepts a complete guide", () => {
    expect(blogArticleSchema.safeParse({ ...base, kind: "GUIDE", guide }).success).toBe(true);
  });

  it("requires the guide sheet for a guide", () => {
    expect(blogArticleSchema.safeParse({ ...base, kind: "GUIDE" }).success).toBe(false);
  });

  it("forbids the guide sheet on an article or an essai, and a road-test sheet on a guide", () => {
    expect(blogArticleSchema.safeParse({ ...base, kind: "ARTICLE", guide }).success).toBe(false);
    const roadTest = { rating: 4, prosFr: "a", prosAr: "أ", consFr: "b", consAr: "ب", verdictFr: text(30), verdictAr: text(30) };
    expect(blogArticleSchema.safeParse({ ...base, kind: "ESSAI", roadTest, guide }).success).toBe(false);
    expect(blogArticleSchema.safeParse({ ...base, kind: "GUIDE", guide, roadTest }).success).toBe(false);
  });

  it("forbids an external source on a guide (it is written by the editorial team)", () => {
    expect(blogArticleSchema.safeParse({ ...base, kind: "GUIDE", guide, sourceName: "Un magazine", sourceUrl: "https://exemple.fr/x" }).success).toBe(false);
  });

  it("allows a cover image on a guide, like an essai, but not on a magazine article", () => {
    expect(blogArticleSchema.safeParse({ ...base, kind: "GUIDE", guide, coverImageUrl: "/uploads/blog-covers/x.jpg" }).success).toBe(true);
    expect(blogArticleSchema.safeParse({ ...base, kind: "ARTICLE", coverImageUrl: "/uploads/blog-covers/x.jpg" }).success).toBe(false);
  });

  it("keeps the other kinds working as before", () => {
    expect(blogArticleSchema.safeParse({ ...base, kind: "ARTICLE" }).success).toBe(true);
    expect(blogArticleSchema.safeParse({ ...base }).success).toBe(true); // type par défaut : article
    expect(blogArticleSchema.safeParse({ ...base, kind: "ESSAI" }).success).toBe(false); // un essai exige sa fiche
    expect(blogArticleSchema.safeParse({ ...base, kind: "LIVRE" }).success).toBe(false);
  });

  it("keeps the same publication rules as the other articles (draft, now, scheduled)", () => {
    expect(blogArticleSchema.safeParse({ ...base, kind: "GUIDE", guide, publication: { mode: "now" } }).success).toBe(true);
    expect(blogArticleSchema.safeParse({ ...base, kind: "GUIDE", guide, publication: { mode: "scheduled", at: "2030-01-01T09:00:00.000Z" } }).success).toBe(true);
    expect(blogArticleSchema.safeParse({ ...base, kind: "GUIDE", guide, publication: { mode: "scheduled", at: "demain" } }).success).toBe(false);
  });
});

describe("articlePublicPath / articleAdminSection", () => {
  it("sends each kind to its own section: the three kinds share one slug space", () => {
    expect(articlePublicPath("ARTICLE", "un-article")).toBe("/mag/un-article");
    expect(articlePublicPath("ESSAI", "un-essai")).toBe("/essais/un-essai");
    expect(articlePublicPath("GUIDE", "un-guide")).toBe("/guides/un-guide");
    expect(articleAdminSection("ARTICLE")).toBe("mag");
    expect(articleAdminSection("ESSAI")).toBe("essais");
    expect(articleAdminSection("GUIDE")).toBe("guides");
  });

  it("gives the section root when the slug is empty (used by the admin list)", () => {
    expect(articlePublicPath("GUIDE", "").replace(/\/$/, "")).toBe("/guides");
  });
});
