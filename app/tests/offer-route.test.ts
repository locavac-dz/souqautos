import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const offerFindUnique = vi.fn();
const offerUpdate = vi.fn();
const offerUpdateMany = vi.fn();
const listingUpdate = vi.fn();
const transaction = vi.fn();
const getCurrentUser = vi.fn();
const checkRateLimit = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    offer: {
      findUnique: (...a: unknown[]) => offerFindUnique(...a),
      update: (...a: unknown[]) => offerUpdate(...a),
    },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/mailer", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined), escapeHtml: (s: string) => s }));
vi.mock("@/lib/push-send", () => ({ sendPushToUser: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return { ...actual, after: vi.fn() };
});
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));
vi.mock("@/lib/site", () => ({ SITE_URL: "https://souqauto.example" }));

import { PATCH, PUT } from "@/app/api/offers/[id]/route";

function request(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}
const params = (id = "offer1") => ({ params: Promise.resolve({ id }) });

const pendingOffer = {
  id: "offer1",
  listingId: "listing1",
  buyerId: "buyer1",
  sellerId: "seller1",
  status: "PENDING",
  amount: 500_000,
  buyer: { email: "buyer@example.com", locale: "fr" },
  seller: { email: "seller@example.com", locale: "fr" },
  listing: { id: "listing1", title: "BMW Série 3" },
};

const counteredOffer = { ...pendingOffer, status: "COUNTERED" };

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue({ id: "seller1" });
  checkRateLimit.mockResolvedValue(true);
  offerFindUnique.mockResolvedValue(pendingOffer);
  transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
    cb({ offer: { update: offerUpdate, updateMany: offerUpdateMany }, listing: { update: listingUpdate } })
  );
  offerUpdate.mockResolvedValue({ ...pendingOffer, status: "ACCEPTED" });
  offerUpdateMany.mockResolvedValue({ count: 0 });
  listingUpdate.mockResolvedValue({});
});

describe("PATCH /api/offers/[id]", () => {
  it("rejects unauthenticated requests", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await PATCH(request({ action: "ACCEPTED" }), params())).status).toBe(401);
    expect(offerFindUnique).not.toHaveBeenCalled();
  });

  it("answers 429 when the rate limit is exceeded, before touching the database", async () => {
    checkRateLimit.mockResolvedValue(false);
    expect((await PATCH(request({ action: "ACCEPTED" }), params())).status).toBe(429);
    expect(offerFindUnique).not.toHaveBeenCalled();
  });

  it("uses a per-user rate-limit key", async () => {
    await PATCH(request({ action: "ACCEPTED" }), params());
    expect(checkRateLimit).toHaveBeenCalledWith(
      "offer:action:seller1",
      expect.objectContaining({ limit: 20 })
    );
  });

  it("answers 404 when the offer does not exist", async () => {
    offerFindUnique.mockResolvedValue(null);
    expect((await PATCH(request({ action: "ACCEPTED" }), params())).status).toBe(404);
  });

  it("answers 404 when the offer is already closed (not PENDING or COUNTERED)", async () => {
    offerFindUnique.mockResolvedValue({ ...pendingOffer, status: "ACCEPTED" });
    expect((await PATCH(request({ action: "DECLINED" }), params())).status).toBe(404);
  });

  it("rejects a malformed body or unknown action", async () => {
    expect((await PATCH(request(null), params())).status).toBe(400);
    expect((await PATCH(request({ action: "IGNORED" }), params())).status).toBe(400);
    // COUNTERED without counterAmount fails respondOfferSchema superRefine
    expect((await PATCH(request({ action: "COUNTERED" }), params())).status).toBe(400);
  });

  it("forbids the buyer from accepting or declining a PENDING offer", async () => {
    getCurrentUser.mockResolvedValue({ id: "buyer1" });
    expect((await PATCH(request({ action: "ACCEPTED" }), params())).status).toBe(403);
    expect((await PATCH(request({ action: "DECLINED" }), params())).status).toBe(403);
  });

  it("forbids the seller from withdrawing a PENDING offer (buyer only)", async () => {
    expect((await PATCH(request({ action: "WITHDRAWN" }), params())).status).toBe(403);
  });

  it("seller accepts PENDING: updates offer, declines other offers, marks listing VENDUE", async () => {
    const res = await PATCH(request({ action: "ACCEPTED" }), params());
    expect(res.status).toBe(200);
    expect(offerUpdate).toHaveBeenCalledWith({
      where: { id: "offer1" },
      data: { status: "ACCEPTED", counterAmount: undefined },
    });
    expect(offerUpdateMany).toHaveBeenCalledWith({
      where: { listingId: "listing1", status: { in: ["PENDING", "COUNTERED"] }, id: { not: "offer1" } },
      data: { status: "DECLINED" },
    });
    expect(listingUpdate).toHaveBeenCalledWith({
      where: { id: "listing1" },
      data: { status: "VENDUE" },
    });
  });

  it("seller declines PENDING offer: updates offer only, does not close the listing", async () => {
    const res = await PATCH(request({ action: "DECLINED" }), params());
    expect(res.status).toBe(200);
    expect(offerUpdate).toHaveBeenCalledWith({
      where: { id: "offer1" },
      data: { status: "DECLINED", counterAmount: undefined },
    });
    expect(listingUpdate).not.toHaveBeenCalled();
  });

  it("seller counters PENDING offer with a counter amount", async () => {
    const res = await PATCH(request({ action: "COUNTERED", counterAmount: 450_000 }), params());
    expect(res.status).toBe(200);
    expect(offerUpdate).toHaveBeenCalledWith({
      where: { id: "offer1" },
      data: { status: "COUNTERED", counterAmount: 450_000 },
    });
    expect(listingUpdate).not.toHaveBeenCalled();
  });

  it("buyer withdraws PENDING offer", async () => {
    getCurrentUser.mockResolvedValue({ id: "buyer1" });
    const res = await PATCH(request({ action: "WITHDRAWN" }), params());
    expect(res.status).toBe(200);
    expect(offerUpdate).toHaveBeenCalledWith({
      where: { id: "offer1" },
      data: { status: "WITHDRAWN", counterAmount: undefined },
    });
  });

  it("buyer accepts COUNTERED offer", async () => {
    getCurrentUser.mockResolvedValue({ id: "buyer1" });
    offerFindUnique.mockResolvedValue(counteredOffer);
    expect((await PATCH(request({ action: "ACCEPTED" }), params())).status).toBe(200);
  });

  it("buyer declines COUNTERED offer", async () => {
    getCurrentUser.mockResolvedValue({ id: "buyer1" });
    offerFindUnique.mockResolvedValue(counteredOffer);
    expect((await PATCH(request({ action: "DECLINED" }), params())).status).toBe(200);
  });

  it("forbids the seller from acting on a COUNTERED offer (buyer's turn only)", async () => {
    offerFindUnique.mockResolvedValue(counteredOffer);
    expect((await PATCH(request({ action: "DECLINED" }), params())).status).toBe(403);
  });
});

describe("PUT /api/offers/[id]", () => {
  beforeEach(() => {
    getCurrentUser.mockResolvedValue({ id: "buyer1" });
    offerFindUnique.mockResolvedValue({ buyerId: "buyer1", status: "PENDING" });
    offerUpdate.mockResolvedValue({ id: "offer1", amount: 450_000, message: null });
  });

  it("rejects unauthenticated requests", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await PUT(request({ amount: 450_000 }), params())).status).toBe(401);
  });

  it("answers 429 when the rate limit is exceeded", async () => {
    checkRateLimit.mockResolvedValue(false);
    expect((await PUT(request({ amount: 450_000 }), params())).status).toBe(429);
  });

  it("answers 404 when the offer does not exist or is not PENDING", async () => {
    offerFindUnique.mockResolvedValue(null);
    expect((await PUT(request({ amount: 450_000 }), params())).status).toBe(404);

    offerFindUnique.mockResolvedValue({ buyerId: "buyer1", status: "COUNTERED" });
    expect((await PUT(request({ amount: 450_000 }), params())).status).toBe(404);
  });

  it("forbids anyone other than the buyer", async () => {
    getCurrentUser.mockResolvedValue({ id: "seller1" });
    expect((await PUT(request({ amount: 450_000 }), params())).status).toBe(403);
  });

  it("updates amount and message, returns the updated offer", async () => {
    const res = await PUT(request({ amount: 450_000, message: "Je confirme." }), params());
    expect(res.status).toBe(200);
    expect(offerUpdate).toHaveBeenCalledWith({
      where: { id: "offer1" },
      data: { amount: 450_000, message: "Je confirme." },
    });
  });

  it("rejects zero, negative, non-integer and missing amounts", async () => {
    expect((await PUT(request({ amount: 0 }), params())).status).toBe(400);
    expect((await PUT(request({ amount: -1 }), params())).status).toBe(400);
    expect((await PUT(request({}), params())).status).toBe(400);
    expect((await PUT(request(null), params())).status).toBe(400);
  });
});
