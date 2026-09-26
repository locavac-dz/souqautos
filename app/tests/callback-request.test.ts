import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const listingFindUnique = vi.fn();
const callbackRequestCreate = vi.fn();
const checkRateLimit = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: { findUnique: (...a: unknown[]) => listingFindUnique(...a) },
    callbackRequest: { create: (...a: unknown[]) => callbackRequestCreate(...a) },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));

import { POST } from "@/app/api/callback-requests/route";

function request(body: unknown, ip = "203.0.113.5"): NextRequest {
  return {
    json: async () => body,
    headers: { get: (name: string) => (name === "x-forwarded-for" ? ip : null) },
  } as unknown as NextRequest;
}

const proListing = {
  id: "listing1",
  status: "PUBLIEE",
  seller: { professionalAccount: { id: "pro1" } },
};

const validBody = {
  listingId: "listing1",
  callerName: "Ahmed",
  callerPhone: "0551234567",
  preferredTime: "MATIN" as const,
};

beforeEach(() => {
  vi.resetAllMocks();
  checkRateLimit.mockResolvedValue(true);
  listingFindUnique.mockResolvedValue(proListing);
  callbackRequestCreate.mockResolvedValue({});
});

describe("POST /api/callback-requests", () => {
  it("creates a callback request for a valid pro listing", async () => {
    const res = await POST(request(validBody));
    expect(res.status).toBe(201);
    expect(callbackRequestCreate).toHaveBeenCalledWith({
      data: {
        proAccountId: "pro1",
        listingId: "listing1",
        callerName: "Ahmed",
        callerPhone: "0551234567",
        preferredTime: "MATIN",
      },
    });
  });

  it("answers 429 when the rate limit is exceeded, without touching the database", async () => {
    checkRateLimit.mockResolvedValue(false);
    const res = await POST(request(validBody));
    expect(res.status).toBe(429);
    expect(listingFindUnique).not.toHaveBeenCalled();
    expect(callbackRequestCreate).not.toHaveBeenCalled();
  });

  it("uses the caller IP as the rate-limit key", async () => {
    await POST(request(validBody, "198.51.100.7"));
    expect(checkRateLimit).toHaveBeenCalledWith(
      "callback-request:198.51.100.7",
      expect.objectContaining({ limit: 5 })
    );
  });

  it("rejects an invalid Algerian phone number", async () => {
    const res = await POST(request({ ...validBody, callerPhone: "0123456789" }));
    expect(res.status).toBe(400);
    expect(callbackRequestCreate).not.toHaveBeenCalled();
  });

  it("rejects a callerName that is too short or missing", async () => {
    expect((await POST(request({ ...validBody, callerName: "A" }))).status).toBe(400);
    expect((await POST(request({ ...validBody, callerName: undefined }))).status).toBe(400);
  });

  it("rejects when the listing does not exist or is not published as a pro listing", async () => {
    listingFindUnique.mockResolvedValue(null);
    expect((await POST(request(validBody))).status).toBe(404);

    listingFindUnique.mockResolvedValue({
      ...proListing, seller: { professionalAccount: null },
    });
    expect((await POST(request(validBody))).status).toBe(404);
  });

  it("rejects a malformed body without touching the database", async () => {
    expect((await POST(request(null))).status).toBe(400);
    expect((await POST(request({}))).status).toBe(400);
    expect(listingFindUnique).not.toHaveBeenCalled();
  });
});
