import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const listingFindUnique = vi.fn();
const listingUpdate     = vi.fn();
const getCurrentUser    = vi.fn();
const checkRateLimit    = vi.fn();
const canManageListing  = vi.fn();
const checkListingPriceEditable = vi.fn();
const isPriceDrop       = vi.fn();
const favoritesFindMany = vi.fn();
const getTranslations   = vi.fn();
const sendEmail         = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: {
      findUnique: (...a: unknown[]) => listingFindUnique(...a),
      update:     (...a: unknown[]) => listingUpdate(...a),
    },
    favorite: { findMany: (...a: unknown[]) => favoritesFindMany(...a) },
  },
}));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/rate-limit",               () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/listing-access",           () => ({ canManageListing: (...a: unknown[]) => canManageListing(...a) }));
vi.mock("@/lib/listing-lifecycle",        () => ({
  checkListingPriceEditable: (...a: unknown[]) => checkListingPriceEditable(...a),
  isPriceDrop:               (...a: unknown[]) => isPriceDrop(...a),
}));
vi.mock("next-intl/server", () => ({ getTranslations: () => getTranslations() }));
vi.mock("@/lib/mailer", () => ({
  sendEmail:   (...a: unknown[]) => sendEmail(...a),
  escapeHtml:  (s: string) => s,
}));

import { POST } from "@/app/api/listings/[id]/update-price/route";

const USER    = { id: "user1" };
const LISTING = { id: "listing1", sellerId: "user1", price: 1_500_000, status: "PUBLIEE", title: "Peugeot 208" };

function request(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}
function ctx(id = "listing1") {
  return { params: Promise.resolve({ id }) };
}

const tFn = (key: string) => key;

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue(USER);
  checkRateLimit.mockResolvedValue(true);
  listingFindUnique.mockResolvedValue(LISTING);
  canManageListing.mockResolvedValue(true);
  checkListingPriceEditable.mockReturnValue({ ok: true });
  isPriceDrop.mockReturnValue(false);
  listingUpdate.mockResolvedValue({ ...LISTING, price: 1_400_000 });
  favoritesFindMany.mockResolvedValue([]);
  getTranslations.mockResolvedValue(tFn);
  sendEmail.mockResolvedValue({ previewUrl: undefined });
});

describe("POST /api/listings/[id]/update-price", () => {
  it("rejects unauthenticated requests", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(request({ price: 1_400_000 }), ctx());
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    checkRateLimit.mockResolvedValue(false);
    const res = await POST(request({ price: 1_400_000 }), ctx());
    expect(res.status).toBe(429);
    expect(listingFindUnique).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid price (non-integer)", async () => {
    const res = await POST(request({ price: "not-a-number" }), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "validation" });
  });

  it("returns 404 when listing does not exist", async () => {
    listingFindUnique.mockResolvedValue(null);
    const res = await POST(request({ price: 1_400_000 }), ctx());
    expect(res.status).toBe(404);
  });

  it("returns 403 when user cannot manage the listing", async () => {
    canManageListing.mockResolvedValue(false);
    const res = await POST(request({ price: 1_400_000 }), ctx());
    expect(res.status).toBe(403);
  });

  it("returns 400 when the listing status does not allow price edits", async () => {
    checkListingPriceEditable.mockReturnValue({ ok: false, error: "wrong_status" });
    const res = await POST(request({ price: 1_400_000 }), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "wrong_status" });
  });

  it("updates the price and returns the new price", async () => {
    const res = await POST(request({ price: 1_400_000 }), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).price).toBe(1_400_000);
    expect(listingUpdate).toHaveBeenCalledOnce();
    expect(listingUpdate.mock.calls[0][0].data.price).toBe(1_400_000);
  });

  it("rate-limits per user id", async () => {
    await POST(request({ price: 1_400_000 }), ctx());
    expect(checkRateLimit.mock.calls[0][0]).toContain(USER.id);
  });
});
