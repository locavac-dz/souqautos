import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";

const applyChargilyCheckoutState = vi.fn();

vi.mock("@/lib/chargily-events", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chargily-events")>("@/lib/chargily-events");
  return { ...actual, applyChargilyCheckoutState: (...a: unknown[]) => applyChargilyCheckoutState(...a) };
});
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/payment-fulfillment", () => ({}));

import { POST } from "@/app/api/webhooks/chargily/route";

const SECRET = "test_sk_abcdefghijklmnopqrstuvwxyz0123456789";
const sign = (body: string, key = SECRET) => createHmac("sha256", key).update(body).digest("hex");

function request(body: string, signature: string | null, contentLength?: number): NextRequest {
  return {
    text: async () => body,
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === "signature") return signature;
        if (name.toLowerCase() === "content-length") return contentLength === undefined ? null : String(contentLength);
        return null;
      },
    },
  } as unknown as NextRequest;
}

const PAID = JSON.stringify({ id: "evt", entity: "event", type: "checkout.paid", data: { id: "01hjcheckout", status: "paid", amount: 1500, currency: "dzd" } });

beforeEach(() => {
  applyChargilyCheckoutState.mockReset().mockResolvedValue("confirmed");
  vi.stubEnv("CHARGILY_SECRET_KEY", SECRET);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("POST /api/webhooks/chargily", () => {
  it("returns 503 and touches nothing when online payment is not configured", async () => {
    vi.stubEnv("CHARGILY_SECRET_KEY", "");
    const res = await POST(request(PAID, sign(PAID)));
    expect(res.status).toBe(503);
    expect(applyChargilyCheckoutState).not.toHaveBeenCalled();
  });

  it("returns 401 on a missing or wrong signature, without reading the event", async () => {
    expect((await POST(request(PAID, null))).status).toBe(401);
    expect((await POST(request(PAID, sign(PAID, "live_sk_other")))).status).toBe(401);
    expect((await POST(request(PAID.replace("1500", "1"), sign(PAID)))).status).toBe(401);
    expect(applyChargilyCheckoutState).not.toHaveBeenCalled();
  });

  it("refuses an oversized body before reading or signing it (Lot 267, audit F1)", async () => {
    expect((await POST(request(PAID, sign(PAID), 10 * 1024 * 1024))).status).toBe(413);
    const huge = PAID + " ".repeat(70 * 1024);
    expect((await POST(request(huge, sign(huge)))).status).toBe(413);
    expect(applyChargilyCheckoutState).not.toHaveBeenCalled();
  });

  it("returns 400 on an authentic but unreadable body", async () => {
    const notJson = "not json at all";
    expect((await POST(request(notJson, sign(notJson)))).status).toBe(400);
    const notEvent = JSON.stringify({ hello: "world" });
    expect((await POST(request(notEvent, sign(notEvent)))).status).toBe(400);
    expect(applyChargilyCheckoutState).not.toHaveBeenCalled();
  });

  it("applies a signed checkout.paid event and answers 200 with the outcome", async () => {
    const res = await POST(request(PAID, sign(PAID)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, outcome: "confirmed" });
    const [checkout, state, now, reason] = applyChargilyCheckoutState.mock.calls[0] as [unknown, string, Date, string];
    expect(checkout).toMatchObject({ id: "01hjcheckout", amount: 1500 });
    expect(state).toBe("paid");
    expect(now).toBeInstanceOf(Date);
    expect(reason).toBe("chargily:checkout.paid");
  });

  it("answers 200 even when the checkout is unknown or already decided (so Chargily stops retrying)", async () => {
    applyChargilyCheckoutState.mockResolvedValue("unknown_checkout");
    const res = await POST(request(PAID, sign(PAID)));
    expect(res.status).toBe(200);
    expect((await res.json()).outcome).toBe("unknown_checkout");
  });

  it("maps checkout.failed to a cancellation", async () => {
    const failed = JSON.stringify({ type: "checkout.failed", data: { id: "01hjcheckout", status: "failed" } });
    await POST(request(failed, sign(failed)));
    expect(applyChargilyCheckoutState.mock.calls[0][1]).toBe("canceled");
  });
});
