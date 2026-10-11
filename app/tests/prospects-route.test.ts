import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const conversationFindUnique = vi.fn();
const accountFindUnique = vi.fn();
const upsert = vi.fn();
const getCurrentUser = vi.fn();
const checkRateLimit = vi.fn();
const canManageListing = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    conversation: { findUnique: (...a: unknown[]) => conversationFindUnique(...a) },
    professionalAccount: { findUnique: (...a: unknown[]) => accountFindUnique(...a) },
    prospectFollowUp: { upsert: (...a: unknown[]) => upsert(...a) },
  },
}));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/listing-access", () => ({ canManageListing: (...a: unknown[]) => canManageListing(...a) }));

import { PATCH } from "@/app/api/pro/prospects/[conversationId]/route";

const request = (body: unknown): NextRequest =>
  ({
    json: async () => {
      if (body === undefined) throw new Error("no body");
      return body;
    },
  }) as unknown as NextRequest;
const params = (id = "conv1") => ({ params: Promise.resolve({ conversationId: id }) });
const saved = { status: "A_RAPPELER", note: "Rappeler jeudi", updatedAt: new Date("2026-09-19T10:00:00Z") };

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue({ id: "seller1" });
  checkRateLimit.mockResolvedValue(true);
  conversationFindUnique.mockResolvedValue({ id: "conv1", sellerId: "seller1" });
  canManageListing.mockResolvedValue(true);
  accountFindUnique.mockResolvedValue({ id: "acc1" });
  upsert.mockResolvedValue(saved);
});

describe("PATCH /api/pro/prospects/[conversationId]", () => {
  it("saves the status and the note, remembers who did it, and never caches the answer", async () => {
    const res = await PATCH(request({ status: "A_RAPPELER", note: "  Rappeler jeudi  " }), params());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ status: "A_RAPPELER", note: "Rappeler jeudi", updatedAt: saved.updatedAt.toISOString() });
    expect(upsert).toHaveBeenCalledWith({
      where: { conversationId: "conv1" },
      create: { conversationId: "conv1", status: "A_RAPPELER", note: "Rappeler jeudi", updatedById: "seller1" },
      update: { status: "A_RAPPELER", note: "Rappeler jeudi", updatedById: "seller1" },
      select: { status: true, note: true, updatedAt: true },
    });
  });

  it("changing only the status leaves the note alone, and the other way round", async () => {
    await PATCH(request({ status: "GAGNE" }), params());
    expect(upsert.mock.calls[0][0].update).toEqual({ status: "GAGNE", updatedById: "seller1" });
    expect("note" in upsert.mock.calls[0][0].update).toBe(false);
    await PATCH(request({ note: "" }), params());
    expect(upsert.mock.calls[1][0].update).toEqual({ note: null, updatedById: "seller1" });
    expect("status" in upsert.mock.calls[1][0].update).toBe(false);
  });

  it("requires a connection", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await PATCH(request({ status: "PERDU" }), params())).status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("is rate limited per user", async () => {
    checkRateLimit.mockResolvedValue(false);
    expect((await PATCH(request({ status: "PERDU" }), params())).status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith("prospect-update:seller1", expect.objectContaining({ limit: 200 }));
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses invalid bodies before touching the database", async () => {
    for (const body of [undefined, null, {}, { status: "VENDU" }, { note: "x".repeat(501) }, { status: "PERDU", updatedById: "moi" }]) {
      expect((await PATCH(request(body), params())).status, JSON.stringify(body)).toBe(400);
    }
    expect(conversationFindUnique).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("answers « not found » for an unknown conversation AND for one the user cannot manage (existence is not revealed)", async () => {
    conversationFindUnique.mockResolvedValue(null);
    const unknown = await PATCH(request({ status: "PERDU" }), params("inconnue"));
    canManageListing.mockResolvedValue(false);
    conversationFindUnique.mockResolvedValue({ id: "conv1", sellerId: "someoneElse" });
    const foreign = await PATCH(request({ status: "PERDU" }), params());
    expect(unknown.status).toBe(404);
    expect(foreign.status).toBe(404);
    expect(await unknown.json()).toEqual(await foreign.json());
    expect(upsert).not.toHaveBeenCalled();
  });

  it("checks the right to manage the SELLER's listings (owner, or collaborator allowed to manage them)", async () => {
    conversationFindUnique.mockResolvedValue({ id: "conv1", sellerId: "owner9" });
    await PATCH(request({ status: "PERDU" }), params());
    expect(canManageListing).toHaveBeenCalledWith("seller1", "owner9");
  });

  it("is a professional tool: a seller without a professional account gets « not found »", async () => {
    accountFindUnique.mockResolvedValue(null);
    expect((await PATCH(request({ status: "PERDU" }), params())).status).toBe(404);
    expect(accountFindUnique).toHaveBeenCalledWith({ where: { userId: "seller1" }, select: { id: true } });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("retries once as an update when two saves race on a prospect that had no follow-up yet", async () => {
    upsert.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" })).mockResolvedValueOnce(saved);
    expect((await PATCH(request({ status: "A_RAPPELER" }), params())).status).toBe(200);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("does not hide other database errors", async () => {
    upsert.mockRejectedValue(new Error("connection lost"));
    const res = await PATCH(request({ status: "PERDU" }), params());
    expect(res.status).toBe(500);
  });
});
