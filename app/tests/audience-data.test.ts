import { beforeEach, describe, expect, it, vi } from "vitest";

const groupBy = vi.fn();
const aggregate = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { pageViewDay: { groupBy: (...a: unknown[]) => groupBy(...a), aggregate: (...a: unknown[]) => aggregate(...a) } } }));

import { contentHref, loadAudience, percentChange, sharePercent } from "@/lib/audience-data";

const NOW = new Date("2026-09-19T10:00:00Z");
const sum = (n: number) => ({ _sum: { count: n } });

beforeEach(() => {
  vi.resetAllMocks();
  groupBy.mockImplementation(async ({ by }: { by: string[] }) => {
    const key = by.join("+");
    if (key === "day") return [{ day: new Date("2026-09-18T00:00:00Z"), ...sum(30) }, { day: new Date("2026-09-19T00:00:00Z"), ...sum(70) }];
    if (key === "page") return [{ page: "/recherche", ...sum(20) }, { page: "/", ...sum(50) }, { page: "/mag/[slug]", ...sum(30) }];
    if (key === "page+detail") return [{ page: "/mag/[slug]", detail: "mon-article", ...sum(30) }];
    if (key === "referrer") return [{ referrer: "direct", ...sum(40) }, { referrer: "recherche", ...sum(60) }];
    if (key === "device") return [{ device: "mobile", ...sum(80) }, { device: "ordinateur", ...sum(20) }];
    return [{ locale: "fr", ...sum(90) }, { locale: "ar", ...sum(10) }];
  });
  aggregate.mockResolvedValue(sum(50));
});

describe("loadAudience", () => {
  it("totals the window from the per-day counters and sorts every breakdown, biggest first", async () => {
    const report = await loadAudience(7, NOW);
    expect(report.total).toBe(100);
    expect(report.previousTotal).toBe(50);
    expect(report.perDay).toHaveLength(7);
    expect(report.perDay.at(-1)).toEqual({ day: "2026-09-19", value: 70 });
    expect(report.pages.map((p) => p.label)).toEqual(["/", "/mag/[slug]", "/recherche"]);
    expect(report.referrers[0]).toEqual({ label: "recherche", count: 60 });
    expect(report.devices[0]).toEqual({ label: "mobile", count: 80 });
    expect(report.content).toEqual([{ page: "/mag/[slug]", detail: "mon-article", count: 30 }]);
  });

  it("reads only the window, and the previous window of the same length for the trend", async () => {
    await loadAudience(7, NOW);
    expect(groupBy.mock.calls.every((c) => JSON.stringify(c[0].where.day) === JSON.stringify({ gte: new Date("2026-09-13T00:00:00.000Z") }))).toBe(true);
    expect(aggregate.mock.calls[0][0].where.day).toEqual({ gte: new Date("2026-09-06T00:00:00.000Z"), lt: new Date("2026-09-13T00:00:00.000Z") });
  });

  it("only ever asks for grouped counters: nothing that could identify a visitor exists to be read", async () => {
    await loadAudience(30, NOW);
    for (const [args] of groupBy.mock.calls) {
      expect(args.by.every((f: string) => ["day", "page", "detail", "referrer", "device", "locale"].includes(f))).toBe(true);
    }
  });

  it("handles an empty table", async () => {
    groupBy.mockResolvedValue([]);
    aggregate.mockResolvedValue({ _sum: { count: null } });
    const report = await loadAudience(30, NOW);
    expect(report).toMatchObject({ total: 0, previousTotal: 0, pages: [], content: [] });
    expect(report.perDay).toHaveLength(30);
  });
});

describe("percentChange / sharePercent", () => {
  it("compares with the previous period, and says nothing when there is nothing to compare", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(100, 100)).toBe(0);
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(Number.NaN, 5)).toBeNull();
  });
  it("gives a share, 0 when there is nothing", () => {
    expect(sharePercent(1, 3)).toBe(33);
    expect(sharePercent(0, 0)).toBe(0);
    expect(sharePercent(5, 0)).toBe(0);
  });
});

describe("contentHref", () => {
  it("rebuilds the public address of a content from its page model and identifier", () => {
    expect(contentHref("/mag/[slug]", "mon-article")).toBe("/mag/mon-article");
    expect(contentHref("/essais/[slug]", "essai-clio")).toBe("/essais/essai-clio");
    expect(contentHref("/guides/[slug]", "guide-clio")).toBe("/guides/guide-clio");
    expect(contentHref("/voitures/[marque]", "renault")).toBe("/voitures/renault");
    expect(contentHref("/voitures/[marque]/[modele]", "renault/clio")).toBe("/voitures/renault/clio");
    expect(contentHref("/wilaya/[wilaya]", "alger")).toBe("/wilaya/alger");
    expect(contentHref("/recherche", "x")).toBeNull();
  });
});
