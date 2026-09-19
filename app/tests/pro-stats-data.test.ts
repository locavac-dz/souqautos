import { beforeEach, describe, expect, it, vi } from "vitest";

const listingFindMany = vi.fn();
const viewGroupBy = vi.fn();
const contactFindMany = vi.fn();
const favoriteGroupBy = vi.fn();
const conversationFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: { findMany: (...a: unknown[]) => listingFindMany(...a) },
    listingViewDay: { groupBy: (...a: unknown[]) => viewGroupBy(...a) },
    contactEvent: { findMany: (...a: unknown[]) => contactFindMany(...a) },
    favorite: { groupBy: (...a: unknown[]) => favoriteGroupBy(...a) },
    conversation: { findMany: (...a: unknown[]) => conversationFindMany(...a) },
  },
}));

import { loadProStats } from "@/lib/pro-stats-data";

const NOW = new Date("2026-09-19T10:00:00Z");

beforeEach(() => {
  vi.resetAllMocks();
  listingFindMany.mockResolvedValue([
    { id: "l1", title: "Renault Clio 4", status: "PUBLIEE", price: 1800000 },
    { id: "l2", title: "Dacia Logan", status: "VENDUE", price: 1500000 },
    { id: "l3", title: "Kia Picanto", status: "PUBLIEE", price: 1600000 },
  ]);
  viewGroupBy.mockImplementation(async ({ by }: { by: string[] }) =>
    by[0] === "listingId"
      ? [
          { listingId: "l1", _sum: { count: 120 } },
          { listingId: "l2", _sum: { count: 40 } },
        ]
      : [
          { day: new Date("2026-09-18T00:00:00Z"), _sum: { count: 100 } },
          { day: new Date("2026-09-19T00:00:00Z"), _sum: { count: 60 } },
        ]
  );
  contactFindMany.mockResolvedValue([
    { listingId: "l1", channel: "TELEPHONE", createdAt: new Date("2026-09-18T09:00:00Z") },
    { listingId: "l1", channel: "TELEPHONE", createdAt: new Date("2026-09-19T09:00:00Z") },
    { listingId: "l1", channel: "WHATSAPP", createdAt: new Date("2026-09-19T09:30:00Z") },
    { listingId: "l2", channel: "WHATSAPP", createdAt: new Date("2026-09-19T23:30:00Z") }, // 00:30 le 20 en Algérie
  ]);
  favoriteGroupBy.mockResolvedValue([{ listingId: "l1", _count: { _all: 3 } }]);
  conversationFindMany.mockResolvedValue([{ listingId: "l1", createdAt: new Date("2026-09-19T12:00:00Z") }]);
});

describe("loadProStats", () => {
  it("adds up views, favorites, calls, WhatsApp and conversations per listing, and sorts by contacts", async () => {
    const report = await loadProStats("seller1", 7, NOW);
    expect(report.listings.map((l) => l.listingId)).toEqual(["l1", "l2", "l3"]);
    expect(report.listings[0]).toMatchObject({ listingId: "l1", title: "Renault Clio 4", views: 120, favorites: 3, phoneReveals: 2, whatsappOpens: 1, conversations: 1 });
    expect(report.listings[1]).toMatchObject({ listingId: "l2", status: "VENDUE", views: 40, whatsappOpens: 1 });
    // une annonce sans aucune activité apparaît quand même, à zéro
    expect(report.listings[2]).toMatchObject({ listingId: "l3", views: 0, favorites: 0, phoneReveals: 0, whatsappOpens: 0, conversations: 0 });
    expect(report.totals).toEqual({ views: 160, favorites: 3, phoneReveals: 2, whatsappOpens: 2, conversations: 1 });
  });

  it("builds one point per day of the window, in Algeria time", async () => {
    const report = await loadProStats("seller1", 7, NOW);
    expect(report.viewsSeries).toHaveLength(7);
    expect(report.viewsSeries.at(-2)).toEqual({ day: "2026-09-18", value: 100 });
    expect(report.viewsSeries.at(-1)).toEqual({ day: "2026-09-19", value: 60 });
    expect(report.viewsSeries.slice(0, 5).every((p) => p.value === 0)).toBe(true);
    // contacts : le 18 un appel ; le 19 un appel, un WhatsApp et une conversation ; le WhatsApp de 00:30 (heure d'Algérie) est du 20, pas du 19
    const byDay = Object.fromEntries(report.contactsSeries.map((p) => [p.day, p.value]));
    expect(byDay["2026-09-18"]).toBe(1);
    expect(byDay["2026-09-19"]).toBe(3);
  });

  it("reads only the account's own listings, never drafts or listings awaiting moderation", async () => {
    await loadProStats("seller1", 30, NOW);
    expect(listingFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { sellerId: "seller1", status: { in: ["PUBLIEE", "VENDUE", "EXPIREE", "SUSPENDUE"] } } }));
    for (const call of [contactFindMany, conversationFindMany]) {
      expect(call.mock.calls[0][0].where.listingId).toEqual({ in: ["l1", "l2", "l3"] });
    }
  });

  it("bounds every query to the window, starting at midnight Algeria time", async () => {
    await loadProStats("seller1", 7, NOW);
    const since = new Date("2026-09-12T23:00:00.000Z");
    expect(contactFindMany.mock.calls[0][0].where.createdAt).toEqual({ gte: since });
    expect(conversationFindMany.mock.calls[0][0].where.createdAt).toEqual({ gte: since });
    expect(favoriteGroupBy.mock.calls[0][0].where.createdAt).toEqual({ gte: since });
    expect(viewGroupBy.mock.calls[0][0].where.day).toEqual({ gte: new Date("2026-09-13T00:00:00.000Z") });
  });

  it("returns an empty report, without any further query, for an account with no listing", async () => {
    listingFindMany.mockResolvedValue([]);
    const report = await loadProStats("seller1", 7, NOW);
    expect(report.listings).toEqual([]);
    expect(report.totals).toEqual({ views: 0, favorites: 0, phoneReveals: 0, whatsappOpens: 0, conversations: 0 });
    expect(report.viewsSeries).toHaveLength(7);
    expect(viewGroupBy).not.toHaveBeenCalled();
    expect(contactFindMany).not.toHaveBeenCalled();
  });
});
