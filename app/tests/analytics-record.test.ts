import { beforeEach, describe, expect, it, vi } from "vitest";

const executeRaw = vi.fn();
const articleFindFirst = vi.fn();
const brandFindUnique = vi.fn();
const modelFindFirst = vi.fn();
const wilayaFindUnique = vi.fn();
const deleteMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRaw: (...a: unknown[]) => executeRaw(...a),
    blogArticle: { findFirst: (...a: unknown[]) => articleFindFirst(...a) },
    brand: { findUnique: (...a: unknown[]) => brandFindUnique(...a) },
    model: { findFirst: (...a: unknown[]) => modelFindFirst(...a) },
    wilaya: { findUnique: (...a: unknown[]) => wilayaFindUnique(...a) },
    pageViewDay: { deleteMany: (...a: unknown[]) => deleteMany(...a) },
  },
}));

import { clearDetailCache, isKnownContentDetail, purgeOldPageViews, recordPageView } from "@/lib/analytics-record";
import { RETENTION_DAYS } from "@/lib/analytics";

const NOW = new Date("2026-09-19T10:00:00Z");
const record = { locale: "fr", page: "/mag/[slug]", detail: "mon-article", device: "mobile", referrer: "recherche" } as const;

beforeEach(() => {
  vi.resetAllMocks();
  clearDetailCache();
  executeRaw.mockResolvedValue(1);
  articleFindFirst.mockResolvedValue({ id: "a1" });
  brandFindUnique.mockResolvedValue({ id: 1 });
  modelFindFirst.mockResolvedValue({ id: 1 });
  wilayaFindUnique.mockResolvedValue({ id: 16 });
  deleteMany.mockResolvedValue({ count: 3 });
});

describe("isKnownContentDetail", () => {
  it("checks a magazine article against published ARTICLE rows, an essai against ESSAI rows", async () => {
    await isKnownContentDetail("/mag/[slug]", "mon-article", NOW);
    expect(articleFindFirst.mock.calls[0][0].where).toEqual({ slug: "mon-article", kind: "ARTICLE", publishedAt: { lte: NOW } });
    await isKnownContentDetail("/essais/[slug]", "essai-clio", NOW);
    expect(articleFindFirst.mock.calls[1][0].where).toEqual({ slug: "essai-clio", kind: "ESSAI", publishedAt: { lte: NOW } });
  });

  it("checks a guide against published GUIDE rows only", async () => {
    await isKnownContentDetail("/guides/[slug]", "guide-clio", NOW);
    expect(articleFindFirst.mock.calls[0][0].where).toEqual({ slug: "guide-clio", kind: "GUIDE", publishedAt: { lte: NOW } });
  });

  it("checks brands, models (under their brand) and wilayas", async () => {
    await isKnownContentDetail("/voitures/[marque]", "renault", NOW);
    expect(brandFindUnique).toHaveBeenCalledWith({ where: { slug: "renault" }, select: { id: true } });
    await isKnownContentDetail("/voitures/[marque]/[modele]", "renault/clio", NOW);
    expect(modelFindFirst.mock.calls[0][0].where).toEqual({ slug: "clio", brand: { slug: "renault" } });
    await isKnownContentDetail("/wilaya/[wilaya]", "alger", NOW);
    expect(wilayaFindUnique).toHaveBeenCalledWith({ where: { slug: "alger" }, select: { id: true } });
  });

  it("is false for unknown content, an empty detail, and pages that have no detail", async () => {
    articleFindFirst.mockResolvedValue(null);
    expect(await isKnownContentDetail("/mag/[slug]", "inconnu", NOW)).toBe(false);
    expect(await isKnownContentDetail("/mag/[slug]", "", NOW)).toBe(false);
    expect(await isKnownContentDetail("/annonce/[id]", "abc", NOW)).toBe(false);
  });

  it("remembers answers, refusals included, so a burst of invented slugs costs one query", async () => {
    articleFindFirst.mockResolvedValue(null);
    for (let i = 0; i < 20; i++) await isKnownContentDetail("/mag/[slug]", "invente", NOW);
    expect(articleFindFirst).toHaveBeenCalledTimes(1);
  });

  it("forgets a refusal quickly (a new article can appear) and an acceptance later", async () => {
    articleFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "a1" });
    expect(await isKnownContentDetail("/mag/[slug]", "nouveau", NOW)).toBe(false);
    expect(await isKnownContentDetail("/mag/[slug]", "nouveau", new Date(NOW.getTime() + 2 * 60 * 1000))).toBe(true);
    expect(articleFindFirst).toHaveBeenCalledTimes(2);
  });
});

describe("recordPageView", () => {
  const sqlOf = () => {
    const [strings, ...values] = executeRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    return { sql: strings.join("?"), values };
  };

  it("adds one to the day's counter with an atomic upsert on the Algeria calendar day", async () => {
    await recordPageView(record, NOW);
    const { sql, values } = sqlOf();
    expect(sql).toContain('INSERT INTO "PageViewDay"');
    expect(sql).toContain("Africa/Algiers");
    expect(sql).toContain('ON CONFLICT ("day", "page", "detail", "locale", "device", "referrer") DO UPDATE SET "count" = "PageViewDay"."count" + 1');
    expect(values).toEqual(["/mag/[slug]", "mon-article", "fr", "mobile", "recherche"]);
  });

  it("passes every value as a bound parameter, never inside the query text", async () => {
    await recordPageView({ ...record, detail: "x'); DROP TABLE \"PageViewDay\";--" }, NOW);
    expect(sqlOf().sql).not.toContain("DROP TABLE");
  });

  it("keeps the page view but drops the detail when the content does not exist", async () => {
    articleFindFirst.mockResolvedValue(null);
    await recordPageView(record, NOW);
    expect(sqlOf().values[1]).toBe("");
  });

  it("stores no personal data: the only values written are page, detail, language, device and origin category", async () => {
    await recordPageView(record, NOW);
    expect(sqlOf().values).toHaveLength(5);
  });

  it("never throws: measuring must not break the site", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    executeRaw.mockRejectedValue(new Error("connection lost"));
    await expect(recordPageView(record, NOW)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("connection lost"));
    spy.mockRestore();
  });
});

describe("purgeOldPageViews", () => {
  it("deletes counters older than 25 months and reports how many", async () => {
    expect(RETENTION_DAYS).toBe(760);
    const count = await purgeOldPageViews(NOW);
    expect(count).toBe(3);
    const cutoff = deleteMany.mock.calls[0][0].where.day.lt as Date;
    expect(Math.round((NOW.getTime() - cutoff.getTime()) / 86400000)).toBe(760);
  });
});
