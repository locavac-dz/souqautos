import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Lot 267 (audit B6) — la résolution d'adresses (création de groupes) est bornée : sans plafond, 49 adresses
// par appel permettaient d'énumérer les inscrits.
const getCurrentUser = vi.fn();
const checkRateLimit = vi.fn();
const findMany = vi.fn();

vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findMany: (...a: unknown[]) => findMany(...a) } } }));

import { POST } from "@/app/api/users/lookup-by-emails/route";

function request(body: unknown): NextRequest {
  return { json: async () => body, headers: { get: () => null } } as unknown as NextRequest;
}

beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue({ id: "u1" });
  checkRateLimit.mockReset().mockResolvedValue(true);
  findMany.mockReset().mockResolvedValue([{ id: "u2", email: "b@example.dz" }]);
});

describe("POST /api/users/lookup-by-emails", () => {
  it("rejects anonymous callers", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await POST(request({ emails: ["b@example.dz"] }))).status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("is rate limited per user, before any lookup", async () => {
    checkRateLimit.mockResolvedValue(false);
    const res = await POST(request({ emails: ["b@example.dz"] }));
    expect(res.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith("lookup-emails:u1", { limit: 20, windowMs: 60 * 60 * 1000 });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("resolves known addresses and lists the unknown ones, lowercased and deduplicated", async () => {
    const res = await POST(request({ emails: ["B@example.dz", "b@example.dz", "c@example.dz"] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ users: [{ id: "u2", email: "b@example.dz" }], notFound: ["c@example.dz"] });
    expect(findMany.mock.calls[0][0].where).toEqual({ email: { in: ["b@example.dz", "c@example.dz"] }, deletedAt: null });
  });

  it("validates the body (1 to 49 addresses)", async () => {
    expect((await POST(request({ emails: [] }))).status).toBe(400);
    expect((await POST(request({ emails: ["pas-une-adresse"] }))).status).toBe(400);
    expect((await POST(request({ emails: Array.from({ length: 50 }, (_, i) => `p${i}@example.dz`) }))).status).toBe(400);
  });
});
