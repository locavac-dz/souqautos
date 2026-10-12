import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  CHARGILY_LIVE_BASE_URL,
  CHARGILY_TEST_BASE_URL,
  ChargilyApiError,
  createChargilyCheckout,
  parseChargilyEvent,
  resolveChargilyConfig,
  retrieveChargilyCheckout,
  verifyChargilySignature,
} from "@/lib/chargily";

const TEST_KEY = "test_sk_abcdefghijklmnopqrstuvwxyz0123456789";
const LIVE_KEY = "live_sk_abcdefghijklmnopqrstuvwxyz0123456789";

describe("resolveChargilyConfig", () => {
  it("is disabled without a key (bank transfer only, never a broken button)", () => {
    expect(resolveChargilyConfig({})).toEqual({ mode: "disabled" });
    expect(resolveChargilyConfig({ CHARGILY_SECRET_KEY: "   " })).toEqual({ mode: "disabled" });
  });

  it("derives the mode from the key prefix, never from a separate variable", () => {
    const test = resolveChargilyConfig({ CHARGILY_SECRET_KEY: TEST_KEY });
    expect(test).toMatchObject({ mode: "enabled", config: { mode: "test", baseUrl: CHARGILY_TEST_BASE_URL, secretKey: TEST_KEY } });
    const live = resolveChargilyConfig({ CHARGILY_SECRET_KEY: LIVE_KEY, NODE_ENV: "production" });
    expect(live).toMatchObject({ mode: "enabled", config: { mode: "live", baseUrl: CHARGILY_LIVE_BASE_URL } });
  });

  it("rejects a key that is not a Chargily secret key", () => {
    const r = resolveChargilyConfig({ CHARGILY_SECRET_KEY: "sk_live_stripe_like" });
    expect(r.mode).toBe("error");
  });

  it("refuses a TEST key in production (the site would offer online payment and cash nothing)", () => {
    const r = resolveChargilyConfig({ CHARGILY_SECRET_KEY: TEST_KEY, NODE_ENV: "production" });
    expect(r.mode).toBe("error");
    expect(r.mode === "error" && r.reason).toContain("TEST");
  });

  it("honours the test-only base URL override outside production, and ignores it in production", () => {
    const dev = resolveChargilyConfig({ CHARGILY_SECRET_KEY: TEST_KEY, CHARGILY_API_BASE_URL: "http://127.0.0.1:5189/" });
    expect(dev.mode === "enabled" && dev.config.baseUrl).toBe("http://127.0.0.1:5189");
    const prod = resolveChargilyConfig({ CHARGILY_SECRET_KEY: LIVE_KEY, NODE_ENV: "production", CHARGILY_API_BASE_URL: "http://127.0.0.1:5189" });
    expect(prod.mode === "enabled" && prod.config.baseUrl).toBe(CHARGILY_LIVE_BASE_URL);
  });
});

describe("verifyChargilySignature", () => {
  const body = '{"type":"checkout.paid","data":{"id":"01hj","status":"paid"}}';
  const sign = (payload: string, key: string) => createHmac("sha256", key).update(payload).digest("hex");

  it("accepts the HMAC-SHA256 hex of the raw body with the secret key", () => {
    expect(verifyChargilySignature(body, sign(body, TEST_KEY), TEST_KEY)).toBe(true);
    expect(verifyChargilySignature(body, sign(body, TEST_KEY).toUpperCase(), TEST_KEY)).toBe(true);
  });

  it("rejects a missing, truncated, foreign-key or tampered-body signature", () => {
    expect(verifyChargilySignature(body, null, TEST_KEY)).toBe(false);
    expect(verifyChargilySignature(body, "", TEST_KEY)).toBe(false);
    expect(verifyChargilySignature(body, sign(body, TEST_KEY).slice(0, 20), TEST_KEY)).toBe(false);
    expect(verifyChargilySignature(body, sign(body, LIVE_KEY), TEST_KEY)).toBe(false);
    expect(verifyChargilySignature(body.replace("paid", "failed"), sign(body, TEST_KEY), TEST_KEY)).toBe(false);
  });

  it("is sensitive to the exact bytes (a re-serialised body would not verify)", () => {
    const pretty = JSON.stringify(JSON.parse(body), null, 2);
    expect(verifyChargilySignature(pretty, sign(body, TEST_KEY), TEST_KEY)).toBe(false);
  });
});

describe("parseChargilyEvent", () => {
  it("reads the documented event shape and keeps unknown fields", () => {
    const event = parseChargilyEvent({
      id: "01hjjjzf7wbc454te45mwx35fe",
      entity: "event",
      livemode: "false",
      type: "checkout.paid",
      data: { id: "01hjjj9aymmrwe664nbzrv84sg", entity: "checkout", amount: 50000, currency: "dzd", status: "paid", metadata: null },
    });
    expect(event).toMatchObject({ type: "checkout.paid", data: { id: "01hjjj9aymmrwe664nbzrv84sg", amount: 50000, status: "paid" } });
  });

  it("accepts an unknown event type (ignored later), but refuses a malformed event", () => {
    expect(parseChargilyEvent({ type: "checkout.expired", data: { id: "x" } })?.type).toBe("checkout.expired");
    expect(parseChargilyEvent({ type: "checkout.paid" })).toBeNull();
    expect(parseChargilyEvent({ data: { id: "x" } })).toBeNull();
    expect(parseChargilyEvent({ type: "checkout.paid", data: { id: "" } })).toBeNull();
    expect(parseChargilyEvent("nope")).toBeNull();
  });
});

describe("createChargilyCheckout / retrieveChargilyCheckout (fetch simulé)", () => {
  const config = { secretKey: TEST_KEY, baseUrl: "http://chargily.test/api/v2", mode: "test" as const };
  const fetchMock = vi.fn();

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("posts the amount in DZD with the secret key as Bearer, and returns id + checkout_url", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "01hj5n7cqpaf0mt2d0xx85tgz8", status: "pending", checkout_url: "https://pay.chargily.dz/test/checkouts/01hj5n7cqpaf0mt2d0xx85tgz8/pay" }), { status: 200 }));

    const created = await createChargilyCheckout(config, {
      amountDzd: 1500,
      successUrl: "https://souqauto.example/fr/compte/mes-annonces?paiement=ok",
      failureUrl: "https://souqauto.example/fr/compte/mes-annonces?paiement=echec",
      webhookEndpoint: "https://souqauto.example/api/webhooks/chargily",
      description: "Souq Autos — formule PREMIUM",
      locale: "fr",
    });

    expect(created).toEqual({ id: "01hj5n7cqpaf0mt2d0xx85tgz8", checkoutUrl: "https://pay.chargily.dz/test/checkouts/01hj5n7cqpaf0mt2d0xx85tgz8/pay" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://chargily.test/api/v2/checkouts");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TEST_KEY}`);
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ amount: 1500, currency: "dzd", locale: "fr", webhook_endpoint: "https://souqauto.example/api/webhooks/chargily" });
    expect(body.success_url).toContain("paiement=ok");
    expect(body.failure_url).toContain("paiement=echec");
  });

  it("refuses a non-integer or non-positive amount before any network call", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const base = { successUrl: "s", failureUrl: "f", webhookEndpoint: "w", description: "d", locale: "fr" as const };
    await expect(createChargilyCheckout(config, { ...base, amountDzd: 0 })).rejects.toBeInstanceOf(ChargilyApiError);
    await expect(createChargilyCheckout(config, { ...base, amountDzd: 12.5 })).rejects.toBeInstanceOf(ChargilyApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("turns an HTTP error, a non-JSON body or an incomplete answer into a ChargilyApiError", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const input = { amountDzd: 1500, successUrl: "s", failureUrl: "f", webhookEndpoint: "w", description: "d", locale: "fr" as const };
    fetchMock.mockResolvedValueOnce(new Response("Unauthenticated.", { status: 401 }));
    await expect(createChargilyCheckout(config, input)).rejects.toMatchObject({ name: "ChargilyApiError", status: 401 });
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 200 }));
    await expect(createChargilyCheckout(config, input)).rejects.toBeInstanceOf(ChargilyApiError);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: "x" }), { status: 200 }));
    await expect(createChargilyCheckout(config, input)).rejects.toThrow(/checkout_url/);
  });

  it("retrieves a checkout by id and validates the identifier", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "01hj", status: "paid", amount: 1500, currency: "dzd" }), { status: 200 }));
    const checkout = await retrieveChargilyCheckout(config, "01hj");
    expect(checkout).toMatchObject({ id: "01hj", status: "paid", amount: 1500 });
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("http://chargily.test/api/v2/checkouts/01hj");
    await expect(retrieveChargilyCheckout(config, "../customers")).rejects.toBeInstanceOf(ChargilyApiError);
  });
});
