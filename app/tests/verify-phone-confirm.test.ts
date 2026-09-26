import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const phoneCodeFindFirst = vi.fn();
const phoneCodeUpdate = vi.fn();
const phoneCodeDelete = vi.fn();
const userUpdate = vi.fn();
const getCurrentUser = vi.fn();
const checkRateLimit = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    phoneVerificationCode: {
      findFirst: (...a: unknown[]) => phoneCodeFindFirst(...a),
      update:    (...a: unknown[]) => phoneCodeUpdate(...a),
      delete:    (...a: unknown[]) => phoneCodeDelete(...a),
    },
    user: { update: (...a: unknown[]) => userUpdate(...a) },
  },
}));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));

import { POST } from "@/app/api/auth/verify-phone/confirm/route";

function request(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue({ id: "user1" });
  checkRateLimit.mockResolvedValue(true);
  phoneCodeFindFirst.mockResolvedValue({
    id: "code1",
    code: "123456",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
  });
  phoneCodeUpdate.mockResolvedValue({});
  phoneCodeDelete.mockResolvedValue({});
  userUpdate.mockResolvedValue({});
});

describe("POST /api/auth/verify-phone/confirm", () => {
  it("rejects unauthenticated requests", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(request({ code: "123456" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthenticated" });
  });

  it("answers 429 when the rate limit is exceeded, without touching the database", async () => {
    checkRateLimit.mockResolvedValue(false);
    const res = await POST(request({ code: "123456" }));
    expect(res.status).toBe(429);
    expect(phoneCodeFindFirst).not.toHaveBeenCalled();
  });

  it("uses a per-user rate-limit key (not per-IP)", async () => {
    await POST(request({ code: "123456" }));
    expect(checkRateLimit).toHaveBeenCalledWith(
      "verify-phone:confirm:user1",
      expect.objectContaining({ limit: 10 })
    );
  });

  it("rejects a code that is not exactly 6 digits", async () => {
    expect((await POST(request({ code: "12345" }))).status).toBe(400);
    expect((await POST(request({ code: "1234567" }))).status).toBe(400);
    expect((await POST(request({ code: "" }))).status).toBe(400);
    expect((await POST(request({}))).status).toBe(400);
    expect((await POST(request(null))).status).toBe(400);
  });

  it("returns no_pending_code when the user has no pending verification record", async () => {
    phoneCodeFindFirst.mockResolvedValue(null);
    const res = await POST(request({ code: "123456" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "no_pending_code" });
  });

  it("returns too_many_attempts when the attempt limit is reached, without incrementing further", async () => {
    phoneCodeFindFirst.mockResolvedValue({
      id: "code1", code: "000000", expiresAt: new Date(Date.now() + 600_000), attempts: 5,
    });
    const res = await POST(request({ code: "000000" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "too_many_attempts" });
    expect(phoneCodeUpdate).not.toHaveBeenCalled();
  });

  it("returns expired when the code is past its expiry", async () => {
    phoneCodeFindFirst.mockResolvedValue({
      id: "code1", code: "123456", expiresAt: new Date(Date.now() - 1), attempts: 0,
    });
    const res = await POST(request({ code: "123456" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "expired" });
  });

  it("increments the attempt counter on a wrong code, without marking the phone verified", async () => {
    const res = await POST(request({ code: "000000" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_code" });
    expect(phoneCodeUpdate).toHaveBeenCalledWith({
      where: { id: "code1" },
      data: { attempts: { increment: 1 } },
    });
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("marks the phone as verified and deletes the code on success", async () => {
    const res = await POST(request({ code: "123456" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { phoneVerifiedAt: expect.any(Date) },
    });
    expect(phoneCodeDelete).toHaveBeenCalledWith({ where: { id: "code1" } });
  });
});
