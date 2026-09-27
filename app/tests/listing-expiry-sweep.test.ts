import { beforeEach, describe, expect, it, vi } from "vitest";

const listingUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: {
      updateMany: (...a: unknown[]) => listingUpdateMany(...a),
    },
  },
}));

import { sweepExpiredListings } from "@/lib/listing-expiry-sweep";

beforeEach(() => {
  vi.resetAllMocks();
  listingUpdateMany.mockResolvedValue({ count: 0 });
});

describe("sweepExpiredListings", () => {
  it("marks PUBLIEE listings whose expiresAt is in the past as EXPIREE", async () => {
    const now = new Date("2025-06-01T12:00:00Z");
    await sweepExpiredListings(now);
    expect(listingUpdateMany).toHaveBeenCalledOnce();
    const { where, data } = listingUpdateMany.mock.calls[0][0];
    expect(where.status).toBe("PUBLIEE");
    expect(where.expiresAt.lt).toEqual(now);
    expect(data.status).toBe("EXPIREE");
  });

  it("uses the current time when no argument is passed", async () => {
    const before = Date.now();
    await sweepExpiredListings();
    const after = Date.now();
    const { where } = listingUpdateMany.mock.calls[0][0];
    expect(where.expiresAt.lt.getTime()).toBeGreaterThanOrEqual(before);
    expect(where.expiresAt.lt.getTime()).toBeLessThanOrEqual(after);
  });

  it("does not affect BROUILLON or EXPIREE listings", async () => {
    await sweepExpiredListings();
    const { where } = listingUpdateMany.mock.calls[0][0];
    expect(where.status).toBe("PUBLIEE");
  });
});
