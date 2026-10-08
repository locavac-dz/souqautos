import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const getCurrentUser = vi.fn();
const checkRateLimit = vi.fn();
const canManageListing = vi.fn();
const getPaymentSettings = vi.fn();
const findUniqueListing = vi.fn();
const findFirstOrder = vi.fn();
const createOrder = vi.fn();
const updateOrder = vi.fn();
const deleteOrder = vi.fn();
const createChargilyCheckout = vi.fn();

vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/listing-access", () => ({ canManageListing: (...a: unknown[]) => canManageListing(...a) }));
vi.mock("@/lib/payment-settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payment-settings")>("@/lib/payment-settings");
  return { ...actual, getPaymentSettings: () => getPaymentSettings() };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: { findUnique: (...a: unknown[]) => findUniqueListing(...a) },
    paymentOrder: {
      findFirst: (...a: unknown[]) => findFirstOrder(...a),
      create: (...a: unknown[]) => createOrder(...a),
      update: (...a: unknown[]) => updateOrder(...a),
      delete: (...a: unknown[]) => deleteOrder(...a),
    },
  },
}));
vi.mock("@/lib/chargily", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chargily")>("@/lib/chargily");
  return { ...actual, createChargilyCheckout: (...a: unknown[]) => createChargilyCheckout(...a) };
});
vi.mock("@/lib/site", () => ({ SITE_URL: "https://souqauto.example" }));

import { POST } from "@/app/api/listings/[id]/upgrade-formula/route";
import { ChargilyApiError } from "@/lib/chargily";

const USER = { id: "user-1", locale: "fr" };
const LISTING = { id: "listing-1", sellerId: "user-1", status: "PUBLIEE", formula: "STANDARD" };
const BANK = { bankName: "BNA", bankRib: "0123", bankAccountHolder: "EURL", premiumPriceDzd: 1500, premiumPlusPriceDzd: 3000 };
const NO_BANK = { ...BANK, bankName: null, bankRib: null, bankAccountHolder: null };

function request(body: unknown): NextRequest {
  return { json: async () => body, headers: { get: () => null } } as unknown as NextRequest;
}
const params = Promise.resolve({ id: "listing-1" });

beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue(USER);
  checkRateLimit.mockReset().mockResolvedValue(true);
  canManageListing.mockReset().mockResolvedValue(true);
  getPaymentSettings.mockReset().mockResolvedValue(BANK);
  findUniqueListing.mockReset().mockResolvedValue(LISTING);
  findFirstOrder.mockReset().mockResolvedValue(null);
  createOrder.mockReset().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "order-1", ...data }));
  updateOrder.mockReset().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "order-1", ...data }));
  deleteOrder.mockReset().mockResolvedValue(undefined);
  createChargilyCheckout.mockReset().mockResolvedValue({ id: "chk-1", checkoutUrl: "https://pay.chargily.dz/test/checkouts/chk-1/pay" });
  vi.stubEnv("CHARGILY_SECRET_KEY", "test_sk_abcdefghijklmnopqrstuvwxyz0123456789");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/listings/[id]/upgrade-formula — virement (comportement du Lot 66 conservé)", () => {
  it("creates a VIREMENT order with the seller's reference when no method is given", async () => {
    const res = await POST(request({ formula: "PREMIUM", reference: "VIR-123" }), { params });
    expect(res.status).toBe(201);
    expect(createOrder.mock.calls[0][0].data).toMatchObject({ provider: "VIREMENT", reference: "VIR-123", amountDzd: 1500 });
    expect(createChargilyCheckout).not.toHaveBeenCalled();
  });

  it("rejects a bank transfer without reference, and when bank details are not configured", async () => {
    expect((await POST(request({ formula: "PREMIUM", method: "virement" }), { params })).status).toBe(400);
    getPaymentSettings.mockResolvedValue(NO_BANK);
    const res = await POST(request({ formula: "PREMIUM", reference: "VIR-123" }), { params });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bank_details_missing");
    expect(createOrder).not.toHaveBeenCalled();
  });
});

describe("POST /api/listings/[id]/upgrade-formula — chargily", () => {
  it("creates a CHARGILY order, a checkout at Chargily, stores the checkout id and returns its URL", async () => {
    getPaymentSettings.mockResolvedValue(NO_BANK); // pas besoin de RIB pour payer en ligne
    const res = await POST(request({ formula: "PREMIUM_PLUS", method: "chargily" }), { params });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.checkoutUrl).toBe("https://pay.chargily.dz/test/checkouts/chk-1/pay");
    expect(createOrder.mock.calls[0][0].data).toMatchObject({ provider: "CHARGILY", amountDzd: 3000 });
    const input = createChargilyCheckout.mock.calls[0][1] as Record<string, string | number>;
    expect(input.amountDzd).toBe(3000);
    expect(input.successUrl).toBe("https://souqauto.example/fr/compte/mes-annonces?paiement=ok");
    expect(input.failureUrl).toBe("https://souqauto.example/fr/compte/mes-annonces?paiement=echec");
    expect(input.webhookEndpoint).toBe("https://souqauto.example/api/webhooks/chargily");
    expect(updateOrder.mock.calls[0][0]).toMatchObject({ where: { id: "order-1" }, data: { reference: "order-1", providerCheckoutId: "chk-1" } });
  });

  it("uses the seller's locale for the return addresses and the hosted page", async () => {
    getCurrentUser.mockResolvedValue({ ...USER, locale: "ar" });
    await POST(request({ formula: "PREMIUM", method: "chargily" }), { params });
    const input = createChargilyCheckout.mock.calls[0][1] as Record<string, string>;
    expect(input.locale).toBe("ar");
    expect(input.successUrl).toContain("/ar/compte/mes-annonces");
  });

  it("refuses online payment when Chargily is not configured, before creating anything", async () => {
    vi.stubEnv("CHARGILY_SECRET_KEY", "");
    const res = await POST(request({ formula: "PREMIUM", method: "chargily" }), { params });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("online_payment_unavailable");
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("deletes the order and answers 502 when Chargily does not answer (never a pending order without checkout)", async () => {
    createChargilyCheckout.mockRejectedValue(new ChargilyApiError("délai dépassé", null));
    const res = await POST(request({ formula: "PREMIUM", method: "chargily" }), { params });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("provider_unavailable");
    expect(deleteOrder).toHaveBeenCalledWith({ where: { id: "order-1" } });
  });

  it("still enforces eligibility (a pending order blocks a second one)", async () => {
    findFirstOrder.mockResolvedValue({ id: "pending" });
    const res = await POST(request({ formula: "PREMIUM", method: "chargily" }), { params });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("order_pending");
    expect(createChargilyCheckout).not.toHaveBeenCalled();
  });
});
