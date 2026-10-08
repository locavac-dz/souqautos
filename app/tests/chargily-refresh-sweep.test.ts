import { beforeEach, describe, expect, it, vi } from "vitest";

// Lot 266 — relecture d'une commande chez Chargily (vendeur, admin, balayage), balayage nocturne des commandes
// en attente, et contrôle du prestataire avant une décision admin. Chargily et Prisma simulés.
const findFirstPaymentOrder = vi.fn();
const findUniquePaymentOrder = vi.fn();
const findManyPaymentOrder = vi.fn();
const findFirstProOrder = vi.fn();
const findUniqueProOrder = vi.fn();
const findManyProOrder = vi.fn();
const updateManyPaymentOrder = vi.fn();
const retrieveChargilyCheckout = vi.fn();
const fulfillListing = vi.fn();
const fulfillPro = vi.fn();
const cancelProviderOrder = vi.fn();
const recordPaymentEvent = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    paymentOrder: {
      findFirst: (...a: unknown[]) => findFirstPaymentOrder(...a),
      findUnique: (...a: unknown[]) => findUniquePaymentOrder(...a),
      findMany: (...a: unknown[]) => findManyPaymentOrder(...a),
      updateMany: (...a: unknown[]) => updateManyPaymentOrder(...a),
    },
    proSubscriptionOrder: {
      findFirst: (...a: unknown[]) => findFirstProOrder(...a),
      findUnique: (...a: unknown[]) => findUniqueProOrder(...a),
      findMany: (...a: unknown[]) => findManyProOrder(...a),
      updateMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/chargily", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chargily")>("@/lib/chargily");
  return { ...actual, retrieveChargilyCheckout: (...a: unknown[]) => retrieveChargilyCheckout(...a) };
});
vi.mock("@/lib/payment-fulfillment", () => ({
  fulfillListingFormulaOrderFromProvider: (...a: unknown[]) => fulfillListing(...a),
  fulfillProSubscriptionOrderFromProvider: (...a: unknown[]) => fulfillPro(...a),
  cancelProviderOrder: (...a: unknown[]) => cancelProviderOrder(...a),
}));
vi.mock("@/lib/payment-events", () => ({ recordPaymentEvent: (...a: unknown[]) => recordPaymentEvent(...a) }));
vi.mock("@/lib/staff-alerts", () => ({ notifyStaffOfPending: vi.fn() }));

import { refreshChargilyOrder, sweepPendingChargilyOrders } from "@/lib/chargily-events";
import { checkProviderBeforeDecision } from "@/lib/admin-payment-decision";
import { ChargilyApiError } from "@/lib/chargily";

const NOW = new Date("2026-10-08T22:00:00Z");
const PENDING = { provider: "CHARGILY", providerCheckoutId: "chk-1", status: "EN_ATTENTE" };

beforeEach(() => {
  findFirstPaymentOrder.mockReset().mockResolvedValue(PENDING);
  findUniquePaymentOrder.mockReset().mockResolvedValue({ status: "CONFIRMEE" });
  findManyPaymentOrder.mockReset().mockResolvedValue([]);
  findFirstProOrder.mockReset().mockResolvedValue(null);
  findUniqueProOrder.mockReset().mockResolvedValue(null);
  findManyProOrder.mockReset().mockResolvedValue([]);
  updateManyPaymentOrder.mockReset().mockResolvedValue({ count: 1 });
  retrieveChargilyCheckout.mockReset().mockResolvedValue({ id: "chk-1", status: "paid", amount: 1000, currency: "dzd" });
  fulfillListing.mockReset().mockResolvedValue("confirmed");
  fulfillPro.mockReset().mockResolvedValue("confirmed");
  cancelProviderOrder.mockReset().mockResolvedValue(true);
  recordPaymentEvent.mockReset().mockResolvedValue(undefined);
  // findOrderByCheckoutId (dans applyChargilyCheckoutState) passe par findUnique sur providerCheckoutId.
  findUniquePaymentOrder.mockImplementation(async (args: { where: { providerCheckoutId?: string; id?: string } }) =>
    args.where.providerCheckoutId ? { id: "order-1", amountDzd: 1000 } : { status: "CONFIRMEE" }
  );
  vi.stubEnv("CHARGILY_SECRET_KEY", "test_sk_abcdefghijklmnopqrstuvwxyz0123456789");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("refreshChargilyOrder", () => {
  it("re-reads the checkout at Chargily, applies the same transition as the webhook, traces the source, and returns the stored status", async () => {
    const result = await refreshChargilyOrder({ kind: "listing_formula", orderId: "order-1", now: NOW, meta: { source: "REFRESH_USER", actorUserId: "u1" }, ownerUserId: "u1" });
    expect(result).toEqual({ ok: true, outcome: "confirmed", status: "CONFIRMEE", providerStatus: "paid" });
    expect(findFirstPaymentOrder.mock.calls[0][0].where).toEqual({ id: "order-1", userId: "u1" });
    expect(retrieveChargilyCheckout.mock.calls[0][1]).toBe("chk-1");
    expect(fulfillListing).toHaveBeenCalledWith("order-1", NOW);
    expect(recordPaymentEvent.mock.calls[0][0]).toMatchObject({ source: "REFRESH_USER", actorUserId: "u1", outcome: "confirmed", providerStatus: "paid" });
  });

  it("does not restrict the owner for an admin re-read", async () => {
    await refreshChargilyOrder({ kind: "listing_formula", orderId: "order-1", now: NOW, meta: { source: "REFRESH_ADMIN", actorUserId: "admin" } });
    expect(findFirstPaymentOrder.mock.calls[0][0].where).toEqual({ id: "order-1" });
  });

  it("answers not_found for a missing, foreign, non-Chargily or checkout-less order", async () => {
    findFirstPaymentOrder.mockResolvedValue(null);
    expect(await refreshChargilyOrder({ kind: "listing_formula", orderId: "x", now: NOW, meta: { source: "REFRESH_USER" } })).toEqual({ ok: false, error: "not_found" });
    findFirstPaymentOrder.mockResolvedValue({ ...PENDING, provider: "VIREMENT" });
    expect(await refreshChargilyOrder({ kind: "listing_formula", orderId: "x", now: NOW, meta: { source: "REFRESH_USER" } })).toEqual({ ok: false, error: "not_found" });
    expect(retrieveChargilyCheckout).not.toHaveBeenCalled();
  });

  it("re-reads an ANNULEE order too (a failed-then-paid checkout must still activate), but never a CONFIRMEE or REJETEE one", async () => {
    findFirstPaymentOrder.mockResolvedValue({ ...PENDING, status: "ANNULEE" });
    expect((await refreshChargilyOrder({ kind: "listing_formula", orderId: "order-1", now: NOW, meta: { source: "SWEEP" } })).ok).toBe(true);
    findFirstPaymentOrder.mockResolvedValue({ ...PENDING, status: "REJETEE" });
    expect(await refreshChargilyOrder({ kind: "listing_formula", orderId: "order-1", now: NOW, meta: { source: "SWEEP" } })).toEqual({ ok: false, error: "already_decided", status: "REJETEE" });
  });

  it("reports the provider as unavailable without touching the order", async () => {
    retrieveChargilyCheckout.mockRejectedValue(new ChargilyApiError("délai dépassé", null));
    expect(await refreshChargilyOrder({ kind: "listing_formula", orderId: "order-1", now: NOW, meta: { source: "REFRESH_USER" } })).toEqual({ ok: false, error: "provider_unavailable", status: "EN_ATTENTE" });
    expect(fulfillListing).not.toHaveBeenCalled();
    expect(recordPaymentEvent).not.toHaveBeenCalled();
  });

  it("refuses when online payment is not configured", async () => {
    vi.stubEnv("CHARGILY_SECRET_KEY", "");
    expect(await refreshChargilyOrder({ kind: "listing_formula", orderId: "order-1", now: NOW, meta: { source: "REFRESH_USER" } })).toEqual({ ok: false, error: "chargily_not_configured" });
  });

  it("cancels the order when Chargily says expired, and leaves it pending when still in progress", async () => {
    retrieveChargilyCheckout.mockResolvedValue({ id: "chk-1", status: "expired" });
    findUniquePaymentOrder.mockImplementation(async (args: { where: { providerCheckoutId?: string } }) => (args.where.providerCheckoutId ? { id: "order-1", amountDzd: 1000 } : { status: "ANNULEE" }));
    const canceled = await refreshChargilyOrder({ kind: "listing_formula", orderId: "order-1", now: NOW, meta: { source: "SWEEP" } });
    expect(canceled).toEqual({ ok: true, outcome: "canceled", status: "ANNULEE", providerStatus: "expired" });
    expect(cancelProviderOrder).toHaveBeenCalledWith("listing_formula", "order-1", "chargily:expired", NOW);

    retrieveChargilyCheckout.mockResolvedValue({ id: "chk-1", status: "pending" });
    findUniquePaymentOrder.mockImplementation(async (args: { where: { providerCheckoutId?: string } }) => (args.where.providerCheckoutId ? { id: "order-1", amountDzd: 1000 } : { status: "EN_ATTENTE" }));
    const pending = await refreshChargilyOrder({ kind: "listing_formula", orderId: "order-1", now: NOW, meta: { source: "SWEEP" } });
    expect(pending).toEqual({ ok: true, outcome: "ignored", status: "EN_ATTENTE", providerStatus: "pending" });
  });
});

describe("sweepPendingChargilyOrders", () => {
  it("skips entirely when Chargily is not configured", async () => {
    vi.stubEnv("CHARGILY_SECRET_KEY", "");
    expect(await sweepPendingChargilyOrders(NOW)).toEqual({ skipped: "chargily_not_configured" });
    expect(findManyPaymentOrder).not.toHaveBeenCalled();
  });

  it("re-reads only pending Chargily orders older than the minimum age, from both tables, and tallies outcomes", async () => {
    findManyPaymentOrder.mockResolvedValue([{ id: "order-1" }]);
    findManyProOrder.mockResolvedValue([{ id: "pro-1" }]);
    findFirstProOrder.mockResolvedValue({ provider: "CHARGILY", providerCheckoutId: "chk-2", status: "EN_ATTENTE" });
    retrieveChargilyCheckout.mockImplementation(async (_c: unknown, id: string) => (id === "chk-2" ? { id, status: "expired" } : { id, status: "paid", amount: 1000, currency: "dzd" }));
    findUniqueProOrder.mockImplementation(async (args: { where: { providerCheckoutId?: string } }) => (args.where.providerCheckoutId === "chk-2" ? { id: "pro-1", amountDzd: 3000 } : { status: "ANNULEE" }));

    const result = await sweepPendingChargilyOrders(NOW, { minAgeMs: 60 * 60 * 1000, limit: 50 });
    expect(result).toEqual({ checked: 2, outcomes: { confirmed: 1, canceled: 1 }, stoppedEarly: false });
    const where = findManyPaymentOrder.mock.calls[0][0].where;
    expect(where).toMatchObject({ provider: "CHARGILY", status: "EN_ATTENTE", providerCheckoutId: { not: null } });
    expect(where.createdAt.lt.getTime()).toBe(NOW.getTime() - 60 * 60 * 1000);
    expect(recordPaymentEvent.mock.calls.every((c) => c[0].source === "SWEEP")).toBe(true);
  });

  it("stops the pass as soon as Chargily is unreachable (no point in queuing 50 timeouts)", async () => {
    findManyPaymentOrder.mockResolvedValue([{ id: "order-1" }, { id: "order-2" }, { id: "order-3" }]);
    retrieveChargilyCheckout.mockRejectedValue(new ChargilyApiError("délai dépassé", null));
    const result = await sweepPendingChargilyOrders(NOW);
    expect(result).toEqual({ checked: 1, outcomes: { provider_unavailable: 1 }, stoppedEarly: true });
    expect(retrieveChargilyCheckout).toHaveBeenCalledOnce();
  });
});

describe("checkProviderBeforeDecision", () => {
  it("always accepts a bank transfer (nothing to ask a provider)", async () => {
    expect(await checkProviderBeforeDecision({ provider: "VIREMENT", providerCheckoutId: null }, "reject")).toEqual({ ok: true, providerStatus: null });
    expect(retrieveChargilyCheckout).not.toHaveBeenCalled();
  });

  it("refuses to reject a checkout Chargily reports as paid (money was taken)", async () => {
    const check = await checkProviderBeforeDecision({ provider: "CHARGILY", providerCheckoutId: "chk-1" }, "reject");
    expect(check).toEqual({ ok: false, error: "paid_at_provider", httpStatus: 409, providerStatus: "paid" });
  });

  it("refuses to approve a checkout Chargily does not report as paid", async () => {
    retrieveChargilyCheckout.mockResolvedValue({ id: "chk-1", status: "pending" });
    expect(await checkProviderBeforeDecision({ provider: "CHARGILY", providerCheckoutId: "chk-1" }, "approve")).toEqual({ ok: false, error: "not_paid_at_provider", httpStatus: 409, providerStatus: "pending" });
    expect(await checkProviderBeforeDecision({ provider: "CHARGILY", providerCheckoutId: "chk-1" }, "reject")).toEqual({ ok: true, providerStatus: "pending" });
  });

  it("accepts an approval of a paid checkout, and reports an unreachable or unconfigured provider", async () => {
    expect(await checkProviderBeforeDecision({ provider: "CHARGILY", providerCheckoutId: "chk-1" }, "approve")).toEqual({ ok: true, providerStatus: "paid" });
    retrieveChargilyCheckout.mockRejectedValue(new Error("ECONNRESET"));
    expect((await checkProviderBeforeDecision({ provider: "CHARGILY", providerCheckoutId: "chk-1" }, "approve"))).toMatchObject({ ok: false, error: "provider_unavailable", httpStatus: 502 });
    vi.stubEnv("CHARGILY_SECRET_KEY", "");
    expect((await checkProviderBeforeDecision({ provider: "CHARGILY", providerCheckoutId: "chk-1" }, "approve"))).toMatchObject({ ok: false, error: "chargily_not_configured", httpStatus: 503 });
  });
});
