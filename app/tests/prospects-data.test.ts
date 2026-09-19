import { beforeEach, describe, expect, it, vi } from "vitest";

const conversationFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { conversation: { findMany: (...a: unknown[]) => conversationFindMany(...a) } } }));

import { MAX_PROSPECTS_LOADED, loadProspects } from "@/lib/prospects-data";

const conv = (o: Record<string, unknown>) => ({
  id: "c1",
  buyerId: "b1",
  createdAt: new Date("2026-09-01T10:00:00Z"),
  listing: { id: "l1", title: "Renault Clio 4", status: "PUBLIEE" },
  buyer: { profile: { displayName: "Karim" } },
  prospectFollowUp: null,
  messages: [],
  ...o,
});

beforeEach(() => {
  vi.resetAllMocks();
  conversationFindMany.mockResolvedValue([
    conv({ id: "c1", messages: [{ senderId: "b1", createdAt: new Date("2026-09-08T10:00:00Z") }] }), // attend une réponse, sans suivi → NOUVEAU
    conv({ id: "c2", buyerId: "b2", buyer: { profile: { displayName: "Sofia" } }, listing: { id: "l2", title: "Dacia Logan", status: "VENDUE" }, prospectFollowUp: { status: "EN_NEGOCIATION", note: "veut 1,4 M" }, messages: [{ senderId: "seller", createdAt: new Date("2026-09-09T10:00:00Z") }] }),
    conv({ id: "c3", buyerId: "b3", buyer: { profile: null }, prospectFollowUp: { status: "PERDU", note: null } }), // sans message : dernière activité = création
  ]);
});

describe("loadProspects", () => {
  it("reads only the seller's conversations that the seller has not hidden, like the inbox", async () => {
    await loadProspects("seller1");
    expect(conversationFindMany.mock.calls[0][0].where).toEqual({ sellerId: "seller1", hiddenBySellerAt: null });
  });

  it("ignores deleted messages when working out who spoke last", async () => {
    await loadProspects("seller1");
    expect(conversationFindMany.mock.calls[0][0].select.messages.where).toEqual({ deletedAt: null });
  });

  it("selects only what the page shows: no buyer e-mail, no phone number", async () => {
    await loadProspects("seller1");
    const select = conversationFindMany.mock.calls[0][0].select;
    expect(select.buyer).toEqual({ select: { profile: { select: { displayName: true } } } });
    expect(JSON.stringify(select)).not.toMatch(/email|phone/i);
  });

  it("defaults to « Nouveau » without a follow-up row, and flags who is waiting for an answer", async () => {
    const report = await loadProspects("seller1");
    const byId = Object.fromEntries(report.rows.map((r) => [r.conversationId, r]));
    expect(byId.c1).toMatchObject({ status: "NOUVEAU", note: null, awaitingReply: true, buyerName: "Karim" });
    expect(byId.c2).toMatchObject({ status: "EN_NEGOCIATION", note: "veut 1,4 M", awaitingReply: false });
    expect(byId.c3).toMatchObject({ status: "PERDU", awaitingReply: false, buyerName: null });
    expect(byId.c3.lastActivityAt).toEqual(new Date("2026-09-01T10:00:00Z"));
  });

  it("sorts the ones waiting for a reply first", async () => {
    const report = await loadProspects("seller1");
    expect(report.rows.map((r) => r.conversationId)).toEqual(["c1", "c2", "c3"]);
  });

  it("filters by status and by listing, and counts on the listing filter only (so every chip stays meaningful)", async () => {
    const byStatus = await loadProspects("seller1", { status: "EN_NEGOCIATION" });
    expect(byStatus.rows.map((r) => r.conversationId)).toEqual(["c2"]);
    expect(byStatus.counts).toEqual({ NOUVEAU: 1, A_RAPPELER: 0, EN_NEGOCIATION: 1, GAGNE: 0, PERDU: 1 });

    const byListing = await loadProspects("seller1", { listingId: "l2" });
    expect(byListing.rows.map((r) => r.conversationId)).toEqual(["c2"]);
    expect(byListing.counts).toEqual({ NOUVEAU: 0, A_RAPPELER: 0, EN_NEGOCIATION: 1, GAGNE: 0, PERDU: 0 });
    expect(byListing.total).toBe(3);
  });

  it("lists the listings that have prospects, for the filter, sorted by title", async () => {
    const report = await loadProspects("seller1");
    expect(report.listings).toEqual([
      { id: "l2", title: "Dacia Logan" },
      { id: "l1", title: "Renault Clio 4" },
    ]);
  });

  it("does not list more than the limit, and says so", async () => {
    conversationFindMany.mockResolvedValue(Array.from({ length: MAX_PROSPECTS_LOADED + 1 }, (_, i) => conv({ id: `c${i}` })));
    const report = await loadProspects("seller1");
    expect(report.rows).toHaveLength(MAX_PROSPECTS_LOADED);
    expect(report.truncated).toBe(true);
    expect(conversationFindMany.mock.calls[0][0].take).toBe(MAX_PROSPECTS_LOADED + 1);
  });

  it("returns an empty report for a seller without any conversation", async () => {
    conversationFindMany.mockResolvedValue([]);
    const report = await loadProspects("seller1");
    expect(report).toMatchObject({ rows: [], total: 0, truncated: false, listings: [] });
  });
});
