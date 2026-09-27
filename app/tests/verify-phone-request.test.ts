import { beforeEach, describe, expect, it, vi } from "vitest";

const phoneCodeDeleteMany = vi.fn();
const phoneCodeCreate    = vi.fn();
const getCurrentUser     = vi.fn();
const checkRateLimit     = vi.fn();
const sendSms            = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    phoneVerificationCode: {
      deleteMany: (...a: unknown[]) => phoneCodeDeleteMany(...a),
      create:     (...a: unknown[]) => phoneCodeCreate(...a),
    },
  },
}));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/rate-limit",               () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/sms",                      () => ({ sendSms: (...a: unknown[]) => sendSms(...a) }));
vi.mock("@/lib/verification",             () => ({
  generateExpiry:     (minutes: number) => new Date(Date.now() + minutes * 60 * 1000),
  generateNumericCode: () => "654321",
}));

import { POST } from "@/app/api/auth/verify-phone/request/route";

const AUTHED_USER = {
  id: "user1",
  phone: "+213555000001",
  phoneVerifiedAt: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue(AUTHED_USER);
  checkRateLimit.mockResolvedValue(true);
  phoneCodeDeleteMany.mockResolvedValue({ count: 0 });
  phoneCodeCreate.mockResolvedValue({});
  sendSms.mockResolvedValue(undefined);
});

describe("POST /api/auth/verify-phone/request", () => {
  it("rejects unauthenticated requests", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthenticated" });
  });

  it("returns 400 when the user has no phone", async () => {
    getCurrentUser.mockResolvedValue({ ...AUTHED_USER, phone: null });
    const res = await POST();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "no_phone" });
  });

  it("returns 400 when the phone is already verified", async () => {
    getCurrentUser.mockResolvedValue({ ...AUTHED_USER, phoneVerifiedAt: new Date() });
    const res = await POST();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "already_verified" });
  });

  it("returns 429 when rate limit exceeded, without touching the database", async () => {
    checkRateLimit.mockResolvedValue(false);
    const res = await POST();
    expect(res.status).toBe(429);
    expect(phoneCodeDeleteMany).not.toHaveBeenCalled();
    expect(phoneCodeCreate).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("rate-limits per user id", async () => {
    await POST();
    const key: string = checkRateLimit.mock.calls[0][0];
    expect(key).toContain(AUTHED_USER.id);
  });

  it("deletes old codes then creates a fresh one with a 10-min expiry", async () => {
    await POST();
    expect(phoneCodeDeleteMany).toHaveBeenCalledWith({ where: { userId: AUTHED_USER.id } });
    expect(phoneCodeCreate).toHaveBeenCalledOnce();
    const { data } = phoneCodeCreate.mock.calls[0][0];
    expect(data.userId).toBe(AUTHED_USER.id);
    expect(data.code).toBe("654321");
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 9 * 60 * 1000);
    expect(data.expiresAt.getTime()).toBeLessThan(Date.now() + 11 * 60 * 1000);
  });

  it("sends the OTP to the user's phone number", async () => {
    await POST();
    expect(sendSms).toHaveBeenCalledOnce();
    const { to, message } = sendSms.mock.calls[0][0];
    expect(to).toBe(AUTHED_USER.phone);
    expect(message).toContain("654321");
  });

  it("returns ok: true on success", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});
