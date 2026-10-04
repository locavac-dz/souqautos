import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const sweepAutoRenewals = vi.fn();
const sweepExpiringListingsForReminders = vi.fn();
const sweepExpiredListings = vi.fn();
const sweepOldNotifications = vi.fn();

vi.mock("@/lib/listing-auto-renew-sweep", () => ({ sweepAutoRenewals: (...a: unknown[]) => sweepAutoRenewals(...a) }));
vi.mock("@/lib/listing-expiry-reminder-sweep", () => ({ sweepExpiringListingsForReminders: (...a: unknown[]) => sweepExpiringListingsForReminders(...a) }));
vi.mock("@/lib/listing-expiry-sweep", () => ({ sweepExpiredListings: (...a: unknown[]) => sweepExpiredListings(...a) }));
vi.mock("@/lib/notification-sweep", () => ({ sweepOldNotifications: (...a: unknown[]) => sweepOldNotifications(...a) }));

import { POST } from "@/app/api/cron/sweep/route";

function request(authorization: string | null = null): NextRequest {
  return {
    headers: { get: (name: string) => (name.toLowerCase() === "authorization" ? authorization : null) },
  } as unknown as NextRequest;
}

beforeEach(() => {
  sweepAutoRenewals.mockReset().mockResolvedValue(undefined);
  sweepExpiringListingsForReminders.mockReset().mockResolvedValue(undefined);
  sweepExpiredListings.mockReset().mockResolvedValue(undefined);
  sweepOldNotifications.mockReset().mockResolvedValue(undefined);
  vi.stubEnv("CRON_SECRET", "test-secret-value");
});

describe("POST /api/cron/sweep", () => {
  it("runs all four sweepers and returns 200 with the correct token", async () => {
    const res = await POST(request("Bearer test-secret-value"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.sweptAt).toBe("string");
    expect(sweepAutoRenewals).toHaveBeenCalledOnce();
    expect(sweepExpiringListingsForReminders).toHaveBeenCalledOnce();
    expect(sweepExpiredListings).toHaveBeenCalledOnce();
    expect(sweepOldNotifications).toHaveBeenCalledOnce();
  });

  it("runs sweepers with the same timestamp for consistency", async () => {
    await POST(request("Bearer test-secret-value"));
    const autoDate = sweepAutoRenewals.mock.calls[0][0] as Date;
    const reminderDate = sweepExpiringListingsForReminders.mock.calls[0][0] as Date;
    const expiryDate = sweepExpiredListings.mock.calls[0][0] as Date;
    const notifDate = sweepOldNotifications.mock.calls[0][0] as Date;
    expect(autoDate).toEqual(reminderDate);
    expect(reminderDate).toEqual(expiryDate);
    expect(expiryDate).toEqual(notifDate);
  });

  it("rejects a wrong token with 401 and does not call any sweeper", async () => {
    const res = await POST(request("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    expect(sweepAutoRenewals).not.toHaveBeenCalled();
    expect(sweepExpiredListings).not.toHaveBeenCalled();
  });

  it("rejects a missing Authorization header with 401", async () => {
    const res = await POST(request(null));
    expect(res.status).toBe(401);
    expect(sweepAutoRenewals).not.toHaveBeenCalled();
  });

  it("rejects a non-Bearer scheme with 401", async () => {
    const res = await POST(request("Basic test-secret-value"));
    expect(res.status).toBe(401);
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await POST(request("Bearer anything"));
    expect(res.status).toBe(500);
    expect(sweepAutoRenewals).not.toHaveBeenCalled();
  });
});
