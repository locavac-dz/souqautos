import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniquePaymentOrder = vi.fn();
const findUniqueProOrder = vi.fn();
const fulfillListing = vi.fn();
const fulfillPro = vi.fn();
const cancelProviderOrder = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    paymentOrder: { findUnique: (...a: unknown[]) => findUniquePaymentOrder(...a) },
    proSubscriptionOrder: { findUnique: (...a: unknown[]) => findUniqueProOrder(...a) },
  },
}));
vi.mock("@/lib/payment-fulfillment", () => ({
  fulfillListingFormulaOrderFromProvider: (...a: unknown[]) => fulfillListing(...a),
  fulfillProSubscriptionOrderFromProvider: (...a: unknown[]) => fulfillPro(...a),
  cancelProviderOrder: (...a: unknown[]) => cancelProviderOrder(...a),
}));

import { applyChargilyCheckoutState, checkoutStatusFromEvent, checkoutStatusFromRetrieve } from "@/lib/chargily-events";

const NOW = new Date("2026-10-08T10:00:00Z");

beforeEach(() => {
  findUniquePaymentOrder.mockReset().mockResolvedValue(null);
  findUniqueProOrder.mockReset().mockResolvedValue(null);
  fulfillListing.mockReset().mockResolvedValue("confirmed");
  fulfillPro.mockReset().mockResolvedValue("confirmed");
  cancelProviderOrder.mockReset().mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("checkoutStatusFromEvent / checkoutStatusFromRetrieve", () => {
  it("only checkout.paid activates; failed / canceled / expired cancel; the rest is ignored", () => {
    expect(checkoutStatusFromEvent("checkout.paid", { id: "c", status: "paid" })).toBe("paid");
    expect(checkoutStatusFromEvent("checkout.paid", { id: "c" })).toBe("paid");
    expect(checkoutStatusFromEvent("checkout.paid", { id: "c", status: "pending" })).toBe("ignored"); // type et statut contradictoires
    expect(checkoutStatusFromEvent("checkout.failed", { id: "c", status: "failed" })).toBe("canceled");
    expect(checkoutStatusFromEvent("checkout.canceled", { id: "c" })).toBe("canceled");
    expect(checkoutStatusFromEvent("checkout.expired", { id: "c" })).toBe("canceled");
    expect(checkoutStatusFromEvent("customer.created", { id: "c" })).toBe("ignored");
  });

  it("maps a retrieved checkout the same way", () => {
    expect(checkoutStatusFromRetrieve({ id: "c", status: "paid" })).toBe("paid");
    expect(checkoutStatusFromRetrieve({ id: "c", status: "canceled" })).toBe("canceled");
    expect(checkoutStatusFromRetrieve({ id: "c", status: "processing" })).toBe("ignored");
    expect(checkoutStatusFromRetrieve({ id: "c" })).toBe("ignored");
  });
});

describe("applyChargilyCheckoutState", () => {
  it("does nothing on an ignored state, without even looking the order up", async () => {
    expect(await applyChargilyCheckoutState({ id: "c1" }, "ignored", NOW, "r")).toBe("ignored");
    expect(findUniquePaymentOrder).not.toHaveBeenCalled();
  });

  it("reports an unknown checkout (answered 200 upstream, never retried) when no order carries that id", async () => {
    expect(await applyChargilyCheckoutState({ id: "c1", status: "paid" }, "paid", NOW, "r")).toBe("unknown_checkout");
    expect(findUniquePaymentOrder).toHaveBeenCalledWith(expect.objectContaining({ where: { providerCheckoutId: "c1" } }));
    expect(findUniqueProOrder).toHaveBeenCalled();
    expect(fulfillListing).not.toHaveBeenCalled();
  });

  it("fulfils a listing-formula order found by checkout id, with the same timestamp", async () => {
    findUniquePaymentOrder.mockResolvedValue({ id: "order-1", amountDzd: 1500 });
    expect(await applyChargilyCheckoutState({ id: "c1", status: "paid", amount: 1500, currency: "dzd" }, "paid", NOW, "r")).toBe("confirmed");
    expect(fulfillListing).toHaveBeenCalledWith("order-1", NOW);
    expect(fulfillPro).not.toHaveBeenCalled();
  });

  it("fulfils a pro-subscription order when the id belongs to that table", async () => {
    findUniqueProOrder.mockResolvedValue({ id: "pro-1", amountDzd: 3000 });
    expect(await applyChargilyCheckoutState({ id: "c2", status: "paid", amount: 3000 }, "paid", NOW, "r")).toBe("confirmed");
    expect(fulfillPro).toHaveBeenCalledWith("pro-1", NOW);
  });

  it("refuses to activate when the amount or the currency does not match the order (left for a human)", async () => {
    findUniquePaymentOrder.mockResolvedValue({ id: "order-1", amountDzd: 1500 });
    expect(await applyChargilyCheckoutState({ id: "c1", status: "paid", amount: 100 }, "paid", NOW, "r")).toBe("amount_mismatch");
    expect(await applyChargilyCheckoutState({ id: "c1", status: "paid", amount: 1500, currency: "eur" }, "paid", NOW, "r")).toBe("amount_mismatch");
    expect(fulfillListing).not.toHaveBeenCalled();
  });

  it("relays the idempotent outcome of the fulfilment (a replayed webhook changes nothing)", async () => {
    findUniquePaymentOrder.mockResolvedValue({ id: "order-1", amountDzd: 1500 });
    fulfillListing.mockResolvedValue("already_decided");
    expect(await applyChargilyCheckoutState({ id: "c1", amount: 1500 }, "paid", NOW, "r")).toBe("already_decided");
  });

  it("cancels a pending order on failure, and reports already_decided when nothing was pending", async () => {
    findUniqueProOrder.mockResolvedValue({ id: "pro-1", amountDzd: 3000 });
    expect(await applyChargilyCheckoutState({ id: "c2", status: "failed" }, "canceled", NOW, "chargily:checkout.failed")).toBe("canceled");
    expect(cancelProviderOrder).toHaveBeenCalledWith("pro_subscription", "pro-1", "chargily:checkout.failed", NOW);
    cancelProviderOrder.mockResolvedValue(false);
    expect(await applyChargilyCheckoutState({ id: "c2", status: "failed" }, "canceled", NOW, "r")).toBe("already_decided");
  });
});
