import { beforeEach, describe, expect, it, vi } from "vitest";

const tokenDeleteMany = vi.fn();
const tokenCreate    = vi.fn();
const getCurrentUser = vi.fn();
const checkRateLimit = vi.fn();
const sendEmail      = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailVerificationToken: {
      deleteMany: (...a: unknown[]) => tokenDeleteMany(...a),
      create:     (...a: unknown[]) => tokenCreate(...a),
    },
  },
}));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/rate-limit",               () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/mailer",                   () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));
vi.mock("@/lib/verification",             () => ({
  generateExpiry: (minutes: number) => new Date(Date.now() + minutes * 60 * 1000),
}));

import { POST } from "@/app/api/auth/verify-email/request/route";

const AUTHED_USER = {
  id: "user1",
  email: "user@example.dz",
  emailVerifiedAt: null,
  locale: "fr",
};

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue(AUTHED_USER);
  checkRateLimit.mockResolvedValue(true);
  tokenDeleteMany.mockResolvedValue({ count: 0 });
  tokenCreate.mockResolvedValue({});
  sendEmail.mockResolvedValue({ previewUrl: undefined });
});

describe("POST /api/auth/verify-email/request", () => {
  it("rejects unauthenticated requests", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthenticated" });
  });

  it("returns 400 if email is already verified", async () => {
    getCurrentUser.mockResolvedValue({ ...AUTHED_USER, emailVerifiedAt: new Date() });
    const res = await POST();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "already_verified" });
  });

  it("returns 429 when rate limit exceeded, without touching the database", async () => {
    checkRateLimit.mockResolvedValue(false);
    const res = await POST();
    expect(res.status).toBe(429);
    expect(tokenDeleteMany).not.toHaveBeenCalled();
    expect(tokenCreate).not.toHaveBeenCalled();
  });

  it("rate-limits per user id, not globally", async () => {
    await POST();
    const key: string = checkRateLimit.mock.calls[0][0];
    expect(key).toContain(AUTHED_USER.id);
  });

  it("deletes old tokens then creates a new one with a hex token and 24h expiry", async () => {
    await POST();
    expect(tokenDeleteMany).toHaveBeenCalledWith({ where: { userId: AUTHED_USER.id } });
    expect(tokenCreate).toHaveBeenCalledOnce();
    const { data } = tokenCreate.mock.calls[0][0];
    expect(data.userId).toBe(AUTHED_USER.id);
    expect(data.token).toMatch(/^[0-9a-f]{64}$/);
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
  });

  it("sends an email to the user containing a verifier-email link", async () => {
    await POST();
    expect(sendEmail).toHaveBeenCalledOnce();
    const { to, html } = sendEmail.mock.calls[0][0];
    expect(to).toBe(AUTHED_USER.email);
    expect(html).toContain("verifier-email");
  });

  it("returns ok: true on success", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});
