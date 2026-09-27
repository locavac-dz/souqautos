import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const userFindUnique = vi.fn();
const blockUpsert = vi.fn();
const blockDeleteMany = vi.fn();
const getCurrentUser = vi.fn();
const checkRateLimit = vi.fn();
const isUniqueViolation = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    block: {
      upsert: (...a: unknown[]) => blockUpsert(...a),
      deleteMany: (...a: unknown[]) => blockDeleteMany(...a),
    },
  },
}));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/prisma-errors", () => ({ isUniqueViolation: (...a: unknown[]) => isUniqueViolation(...a) }));

import { POST, DELETE } from "@/app/api/users/[id]/block/route";

function request(): NextRequest {
  return {} as unknown as NextRequest;
}
const params = (id = "target1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue({ id: "user1" });
  checkRateLimit.mockResolvedValue(true);
  userFindUnique.mockResolvedValue({ id: "target1" });
  blockUpsert.mockResolvedValue({});
  blockDeleteMany.mockResolvedValue({ count: 1 });
  isUniqueViolation.mockReturnValue(false);
});

describe("POST /api/users/[id]/block", () => {
  it("rejects unauthenticated requests", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(request(), params());
    expect(res.status).toBe(401);
    expect(blockUpsert).not.toHaveBeenCalled();
  });

  it("answers 429 when the rate limit is exceeded, before touching the database", async () => {
    checkRateLimit.mockResolvedValue(false);
    const res = await POST(request(), params());
    expect(res.status).toBe(429);
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("uses a per-user rate-limit key", async () => {
    await POST(request(), params());
    expect(checkRateLimit).toHaveBeenCalledWith(
      "user:block:user1",
      expect.objectContaining({ limit: 30 })
    );
  });

  it("rejects blocking one's own account", async () => {
    const res = await POST(request(), params("user1"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "cannot_block_self" });
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("answers 404 when the target user does not exist", async () => {
    userFindUnique.mockResolvedValue(null);
    const res = await POST(request(), params());
    expect(res.status).toBe(404);
    expect(blockUpsert).not.toHaveBeenCalled();
  });

  it("creates the block and returns 201 with the correct payload", async () => {
    const res = await POST(request(), params());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ blocked: true });
    expect(blockUpsert).toHaveBeenCalledWith({
      where: { blockerId_blockedId: { blockerId: "user1", blockedId: "target1" } },
      update: {},
      create: { blockerId: "user1", blockedId: "target1" },
    });
  });

  it("is idempotent: returns 201 even when the block already exists (unique violation)", async () => {
    blockUpsert.mockRejectedValue(new Error("P2002"));
    isUniqueViolation.mockReturnValue(true);
    const res = await POST(request(), params());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ blocked: true });
  });

  it("rethrows unexpected errors from upsert", async () => {
    blockUpsert.mockRejectedValue(new Error("Database connection lost"));
    isUniqueViolation.mockReturnValue(false);
    await expect(POST(request(), params())).rejects.toThrow("Database connection lost");
  });
});

describe("DELETE /api/users/[id]/block", () => {
  it("rejects unauthenticated requests", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await DELETE(request(), params());
    expect(res.status).toBe(401);
    expect(blockDeleteMany).not.toHaveBeenCalled();
  });

  it("removes the block and returns 200", async () => {
    const res = await DELETE(request(), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ blocked: false });
    expect(blockDeleteMany).toHaveBeenCalledWith({
      where: { blockerId: "user1", blockedId: "target1" },
    });
  });
});
