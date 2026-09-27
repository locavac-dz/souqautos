import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const proAccountFindUnique = vi.fn();
const proFollowUpsert      = vi.fn();
const proFollowDeleteMany  = vi.fn();
const getCurrentUser       = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    professionalAccount: { findUnique: (...a: unknown[]) => proAccountFindUnique(...a) },
    proFollow: {
      upsert:     (...a: unknown[]) => proFollowUpsert(...a),
      deleteMany: (...a: unknown[]) => proFollowDeleteMany(...a),
    },
  },
}));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));

import { POST, DELETE } from "@/app/api/pro/[id]/follow/route";

const USER = { id: "user1" };
const PRO_ID = "pro1";

function ctx() {
  return { params: Promise.resolve({ id: PRO_ID }) };
}
const req = {} as NextRequest;

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue(USER);
  proAccountFindUnique.mockResolvedValue({ id: PRO_ID });
  proFollowUpsert.mockResolvedValue({});
  proFollowDeleteMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/pro/[id]/follow", () => {
  it("requires authentication", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(req, ctx());
    expect(res.status).toBe(401);
  });

  it("returns 404 when the pro account does not exist", async () => {
    proAccountFindUnique.mockResolvedValue(null);
    const res = await POST(req, ctx());
    expect(res.status).toBe(404);
  });

  it("upserts the follow record and returns 201", async () => {
    const res = await POST(req, ctx());
    expect(res.status).toBe(201);
    expect((await res.json()).following).toBe(true);
    expect(proFollowUpsert).toHaveBeenCalledOnce();
    const { where, create } = proFollowUpsert.mock.calls[0][0];
    expect(where.userId_proAccountId).toMatchObject({ userId: USER.id, proAccountId: PRO_ID });
    expect(create).toMatchObject({ userId: USER.id, proAccountId: PRO_ID });
  });
});

describe("DELETE /api/pro/[id]/follow", () => {
  it("requires authentication", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await DELETE(req, ctx());
    expect(res.status).toBe(401);
  });

  it("deletes the follow record and returns following: false", async () => {
    const res = await DELETE(req, ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).following).toBe(false);
    expect(proFollowDeleteMany).toHaveBeenCalledWith({
      where: { userId: USER.id, proAccountId: PRO_ID },
    });
  });
});
