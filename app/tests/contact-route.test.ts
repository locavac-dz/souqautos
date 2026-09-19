import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const listingFindUnique = vi.fn();
const userFindUnique = vi.fn();
const blockFindUnique = vi.fn();
const contactCreate = vi.fn();
const getCurrentUser = vi.fn();
const checkRateLimit = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: { findUnique: (...a: unknown[]) => listingFindUnique(...a) },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    block: { findUnique: (...a: unknown[]) => blockFindUnique(...a) },
    contactEvent: { create: (...a: unknown[]) => contactCreate(...a) },
  },
}));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/site", () => ({ SITE_URL: "https://souqauto.example" }));

import { POST } from "@/app/api/listings/[id]/contact/route";

function request(body: unknown, ip = "203.0.113.5"): NextRequest {
  return {
    json: async () => body,
    headers: { get: (name: string) => (name === "x-forwarded-for" ? ip : null) },
  } as unknown as NextRequest;
}
const params = (id = "listing1") => ({ params: Promise.resolve({ id }) });

const publishedListing = {
  id: "listing1",
  title: "Renault Clio 4 diesel",
  status: "PUBLIEE",
  sellerId: "seller1",
  seller: { whatsappEnabled: true, suspendedAt: null, deletedAt: null },
};

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue(null);
  checkRateLimit.mockResolvedValue(true);
  listingFindUnique.mockResolvedValue(publishedListing);
  userFindUnique.mockResolvedValue({ phone: "0555123456" });
  blockFindUnique.mockResolvedValue(null);
  contactCreate.mockResolvedValue({});
});

describe("POST /api/listings/[id]/contact", () => {
  it("reveals the number on request, and never caches the answer", async () => {
    const res = await POST(request({ channel: "TELEPHONE" }), params());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ channel: "TELEPHONE", phone: "0555123456", telUrl: "tel:+213555123456" });
  });

  it("counts each reveal, with the channel and the connected user if any, but no IP and no number", async () => {
    getCurrentUser.mockResolvedValue({ id: "buyer1" });
    await POST(request({ channel: "TELEPHONE" }), params());
    expect(contactCreate).toHaveBeenCalledWith({ data: { listingId: "listing1", channel: "TELEPHONE", userId: "buyer1" } });
    contactCreate.mockClear();
    getCurrentUser.mockResolvedValue(null);
    await POST(request({ channel: "TELEPHONE" }), params());
    expect(contactCreate).toHaveBeenCalledWith({ data: { listingId: "listing1", channel: "TELEPHONE", userId: null } });
  });

  it("reads the phone number DIRECTLY on the user model: nested reads return it encrypted", async () => {
    await POST(request({ channel: "TELEPHONE" }), params());
    expect(userFindUnique).toHaveBeenCalledWith({ where: { id: "seller1" }, select: { phone: true } });
    // garde-fou de non-régression : la lecture de l'annonce ne demande jamais le numéro (il en sortirait chiffré)
    const listingSelect = listingFindUnique.mock.calls[0][0].select as { seller: { select: Record<string, boolean> } };
    expect(listingSelect.seller.select).not.toHaveProperty("phone");
  });

  it("builds a WhatsApp link with a message that names the listing, in the visitor's language", async () => {
    const fr = await (await POST(request({ channel: "WHATSAPP", locale: "fr" }), params())).json();
    const url = new URL(fr.whatsappUrl);
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/213555123456");
    expect(url.searchParams.get("text")).toContain("« Renault Clio 4 diesel »");
    expect(url.searchParams.get("text")).toContain("https://souqauto.example/fr/annonce/listing1");
    expect(fr).not.toHaveProperty("phone");

    const ar = await (await POST(request({ channel: "WHATSAPP", locale: "ar" }), params())).json();
    expect(new URL(ar.whatsappUrl).searchParams.get("text")).toContain("سوق أوتو");
    expect(new URL(ar.whatsappUrl).searchParams.get("text")).toContain("/ar/annonce/listing1");
  });

  it("offers WhatsApp only when the seller opted in", async () => {
    listingFindUnique.mockResolvedValue({ ...publishedListing, seller: { ...publishedListing.seller, whatsappEnabled: false } });
    const res = await POST(request({ channel: "WHATSAPP" }), params());
    expect(res.status).toBe(404);
    expect(contactCreate).not.toHaveBeenCalled();
    // le téléphone reste disponible
    expect((await POST(request({ channel: "TELEPHONE" }), params())).status).toBe(200);
  });

  it("answers 404, without saying why, for anything that is not a contactable published listing", async () => {
    for (const listing of [
      null,
      { ...publishedListing, status: "EN_ATTENTE" },
      { ...publishedListing, status: "SUSPENDUE" },
      { ...publishedListing, status: "VENDUE" },
      { ...publishedListing, seller: { ...publishedListing.seller, suspendedAt: new Date() } },
      { ...publishedListing, seller: { ...publishedListing.seller, deletedAt: new Date() } },
    ]) {
      listingFindUnique.mockResolvedValue(listing);
      const res = await POST(request({ channel: "TELEPHONE" }), params());
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
    }
    expect(contactCreate).not.toHaveBeenCalled();
  });

  it("answers 404 when the seller has no number, or a number in an unexpected format (never a broken link)", async () => {
    userFindUnique.mockResolvedValue({ phone: null });
    expect((await POST(request({ channel: "TELEPHONE" }), params())).status).toBe(404);
    userFindUnique.mockResolvedValue({ phone: "p5GCtnZXwfG+dqKymXTXTu1jzc1DyWXS+p0wWFtb3LMq4ChBqnU=" }); // numéro encore chiffré
    expect((await POST(request({ channel: "TELEPHONE" }), params())).status).toBe(404);
    expect(contactCreate).not.toHaveBeenCalled();
  });

  it("does not give the number to the seller's own account, nor to an account the seller blocked", async () => {
    getCurrentUser.mockResolvedValue({ id: "seller1" });
    const own = await POST(request({ channel: "TELEPHONE" }), params());
    expect(own.status).toBe(400);
    expect(await own.json()).toEqual({ error: "own_listing" });

    getCurrentUser.mockResolvedValue({ id: "buyer1" });
    blockFindUnique.mockResolvedValue({ blockerId: "seller1" });
    expect((await POST(request({ channel: "TELEPHONE" }), params())).status).toBe(404);
    expect(blockFindUnique).toHaveBeenCalledWith({ where: { blockerId_blockedId: { blockerId: "seller1", blockedId: "buyer1" } }, select: { blockerId: true } });
  });

  it("limits anonymous visitors per address and per listing, and connected users per account", async () => {
    await POST(request({ channel: "TELEPHONE" }, "198.51.100.9"), params("listing1"));
    const keys = checkRateLimit.mock.calls.map((c) => c[0]);
    expect(keys).toEqual(["contact-ip:198.51.100.9", "contact-ip-listing:198.51.100.9:listing1"]);

    checkRateLimit.mockClear();
    getCurrentUser.mockResolvedValue({ id: "buyer1" });
    await POST(request({ channel: "TELEPHONE" }), params());
    expect(checkRateLimit.mock.calls.map((c) => c[0])).toEqual(["contact-user:buyer1"]);
  });

  it("answers 429 as soon as a limit is exceeded, before touching the database", async () => {
    checkRateLimit.mockResolvedValue(false);
    const res = await POST(request({ channel: "TELEPHONE" }), params());
    expect(res.status).toBe(429);
    expect(listingFindUnique).not.toHaveBeenCalled();
    expect(contactCreate).not.toHaveBeenCalled();
  });

  it("rejects an unknown channel or locale", async () => {
    expect((await POST(request({ channel: "SMS" }), params())).status).toBe(400);
    expect((await POST(request({}), params())).status).toBe(400);
    expect((await POST(request({ channel: "WHATSAPP", locale: "en" }), params())).status).toBe(400);
    expect((await POST(request(null), params())).status).toBe(400);
  });
});
