import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const getCurrentUser     = vi.fn();
const checkRateLimit     = vi.fn();
const beginEnrolment     = vi.fn();
const confirmEnrolment   = vi.fn();
const disableTwoFactor   = vi.fn();
const createSessionToken = vi.fn();
const setSessionCookie   = vi.fn();

vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/rate-limit",               () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/two-factor", () => ({
  beginEnrolment:   (...a: unknown[]) => beginEnrolment(...a),
  confirmEnrolment: (...a: unknown[]) => confirmEnrolment(...a),
  disableTwoFactor: (...a: unknown[]) => disableTwoFactor(...a),
}));
vi.mock("@/lib/auth-server/session", () => ({
  createSessionToken: (...a: unknown[]) => createSessionToken(...a),
  setSessionCookie:   (...a: unknown[]) => setSessionCookie(...a),
}));

import { POST as setupPost }   from "@/app/api/account/two-factor/setup/route";
import { POST as enablePost }  from "@/app/api/account/two-factor/enable/route";
import { POST as disablePost } from "@/app/api/account/two-factor/disable/route";

const USER = { id: "user1", role: "PARTICULIER" };

function request(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue(USER);
  checkRateLimit.mockResolvedValue(true);
});

// ── Setup ────────────────────────────────────────────────────────────────────

describe("POST /api/account/two-factor/setup", () => {
  it("rejects unauthenticated requests", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await setupPost(request({ password: "secret" }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limit exceeded", async () => {
    checkRateLimit.mockResolvedValue(false);
    const res = await setupPost(request({ password: "secret" }));
    expect(res.status).toBe(429);
    expect(beginEnrolment).not.toHaveBeenCalled();
  });

  it("returns 409 when 2FA is already enabled", async () => {
    beginEnrolment.mockResolvedValue({ ok: false, error: "already_enabled" });
    const res = await setupPost(request({ password: "secret" }));
    expect(res.status).toBe(409);
  });

  // Lot 229 — le mot de passe est transmis au service, qui le vérifie ; refusé → 400, sans rien montrer.
  it("forwards the password and returns 400 when the service refuses it", async () => {
    beginEnrolment.mockResolvedValue({ ok: false, error: "invalid_password" });
    const res = await setupPost(request({ password: "mauvais" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_password" });
    expect(beginEnrolment).toHaveBeenCalledWith("user1", "mauvais");
  });

  it("accepts a request without body (account without password: the service decides)", async () => {
    beginEnrolment.mockResolvedValue({ ok: true, secretDisplay: "X", uri: "x", qr: "x" });
    const res = await setupPost({ json: async () => { throw new Error("no body"); } } as unknown as NextRequest);
    expect(res.status).toBe(200);
    expect(beginEnrolment).toHaveBeenCalledWith("user1", undefined);
  });

  it("returns secret, uri and qr on success", async () => {
    beginEnrolment.mockResolvedValue({ ok: true, secretDisplay: "ABCD EFGH", uri: "otpauth://...", qr: "data:image/png;base64,..." });
    const res = await setupPost(request({ password: "secret" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ secret: "ABCD EFGH", uri: "otpauth://...", qr: expect.any(String) });
  });

  it("response has Cache-Control: no-store", async () => {
    beginEnrolment.mockResolvedValue({ ok: true, secretDisplay: "X", uri: "x", qr: "x" });
    const res = await setupPost(request({ password: "secret" }));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

// ── Enable ───────────────────────────────────────────────────────────────────

describe("POST /api/account/two-factor/enable", () => {
  it("rejects unauthenticated requests", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await enablePost(request({ code: "123456" }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limit exceeded", async () => {
    checkRateLimit.mockResolvedValue(false);
    const res = await enablePost(request({ code: "123456" }));
    expect(res.status).toBe(429);
    expect(confirmEnrolment).not.toHaveBeenCalled();
  });

  it("returns 400 when body is invalid", async () => {
    const res = await enablePost(request({ code: "" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "validation" });
  });

  it("returns 400 when code is wrong", async () => {
    confirmEnrolment.mockResolvedValue({ ok: false, error: "invalid_code" });
    const res = await enablePost(request({ code: "000000" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_code" });
  });

  it("returns recovery codes and refreshes session on success", async () => {
    const recoveryCodes = ["AAA-BBB", "CCC-DDD"];
    confirmEnrolment.mockResolvedValue({ ok: true, recoveryCodes });
    createSessionToken.mockResolvedValue("new-token");
    setSessionCookie.mockResolvedValue(undefined);
    const res = await enablePost(request({ code: "123456" }));
    expect(res.status).toBe(200);
    expect((await res.json()).recoveryCodes).toEqual(recoveryCodes);
    expect(setSessionCookie).toHaveBeenCalled();
  });
});

// ── Disable ──────────────────────────────────────────────────────────────────

describe("POST /api/account/two-factor/disable", () => {
  it("rejects unauthenticated requests", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await disablePost(request({ code: "123456" }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limit exceeded", async () => {
    checkRateLimit.mockResolvedValue(false);
    const res = await disablePost(request({ code: "123456" }));
    expect(res.status).toBe(429);
    expect(disableTwoFactor).not.toHaveBeenCalled();
  });

  it("returns 400 on bad payload", async () => {
    const res = await disablePost(request({}));
    expect(res.status).toBe(400);
  });

  it("returns 409 when 2FA is not enabled", async () => {
    disableTwoFactor.mockResolvedValue({ ok: false, error: "not_enabled" });
    const res = await disablePost(request({ code: "123456" }));
    expect(res.status).toBe(409);
  });

  it("returns 400 for wrong code", async () => {
    disableTwoFactor.mockResolvedValue({ ok: false, error: "invalid_code" });
    const res = await disablePost(request({ code: "000000" }));
    expect(res.status).toBe(400);
  });

  it("returns ok: true on success", async () => {
    disableTwoFactor.mockResolvedValue({ ok: true });
    const res = await disablePost(request({ code: "123456" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});
