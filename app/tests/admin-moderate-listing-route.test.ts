import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const getCurrentUser = vi.fn();
const isStaff = vi.fn();
const findUniqueListing = vi.fn();
const updateManyListing = vi.fn();
const findUniqueUser = vi.fn();
const notifyMatchingSearchAlerts = vi.fn();
const notifyProFollowers = vi.fn();
const sendEmail = vi.fn();
const writeAuditLog = vi.fn();
const updateManyPaymentOrder = vi.fn();

vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/auth-server/roles", () => ({ isStaff: (role: string) => isStaff(role) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: { findUnique: (...a: unknown[]) => findUniqueListing(...a), updateMany: (...a: unknown[]) => updateManyListing(...a) },
    user: { findUnique: (...a: unknown[]) => findUniqueUser(...a) },
    paymentOrder: { updateMany: (...a: unknown[]) => updateManyPaymentOrder(...a) },
  },
}));
vi.mock("@/lib/search-alerts", () => ({ notifyMatchingSearchAlerts: (...a: unknown[]) => notifyMatchingSearchAlerts(...a) }));
vi.mock("@/lib/pro-follow", () => ({ notifyProFollowers: (...a: unknown[]) => notifyProFollowers(...a) }));
vi.mock("@/lib/mailer", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a), escapeHtml: (s: string) => s }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));
vi.mock("@/lib/site", () => ({ SITE_URL: "https://souqauto.example" }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));

import { POST } from "@/app/api/admin/listings/[id]/moderate/route";

const STAFF_USER = { id: "staff-1", role: "ADMIN" };
const LISTING_PENDING = { id: "listing-1", status: "EN_ATTENTE", sellerId: "seller-1", title: "Clio", publishedAt: null, expiresAt: null, moderationNote: null };
const LISTING_PUBLISHED = { ...LISTING_PENDING, status: "PUBLIEE", publishedAt: new Date() };
const SELLER = { id: "seller-1", email: "seller@example.dz", locale: "fr" };

function request(body: unknown): NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
  } as unknown as NextRequest;
}

const params = Promise.resolve({ id: "listing-1" });

beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue(STAFF_USER);
  isStaff.mockReset().mockReturnValue(true);
  findUniqueListing.mockReset().mockResolvedValue(LISTING_PENDING);
  updateManyListing.mockReset().mockResolvedValue({ count: 1 });
  findUniqueUser.mockReset().mockResolvedValue(SELLER);
  notifyMatchingSearchAlerts.mockReset().mockResolvedValue(undefined);
  notifyProFollowers.mockReset().mockResolvedValue(undefined);
  sendEmail.mockReset().mockResolvedValue(null);
  writeAuditLog.mockReset().mockResolvedValue(undefined);
  updateManyPaymentOrder.mockReset().mockResolvedValue({ count: 0 });
});

describe("POST /api/admin/listings/[id]/moderate", () => {
  it("returns 403 when the caller is not staff", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(request({ action: "approve" }), { params });
    expect(res.status).toBe(403);
    expect(findUniqueListing).not.toHaveBeenCalled();
  });

  it("returns 403 when the user exists but is not staff", async () => {
    isStaff.mockReturnValue(false);
    const res = await POST(request({ action: "approve" }), { params });
    expect(res.status).toBe(403);
  });

  it("returns 400 on an invalid action", async () => {
    const res = await POST(request({ action: "delete" }), { params });
    expect(res.status).toBe(400);
    expect(findUniqueListing).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not JSON", async () => {
    const badReq = { json: async () => { throw new Error("bad json"); }, headers: { get: () => null } } as unknown as NextRequest;
    const res = await POST(badReq, { params });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the listing does not exist", async () => {
    findUniqueListing.mockResolvedValue(null);
    const res = await POST(request({ action: "approve" }), { params });
    expect(res.status).toBe(404);
  });

  it("approves a pending listing and notifies search alerts and pro followers", async () => {
    const res = await POST(request({ action: "approve" }), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "PUBLIEE" });
    expect(notifyMatchingSearchAlerts).toHaveBeenCalledOnce();
    expect(notifyProFollowers).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(writeAuditLog).toHaveBeenCalledOnce();
  });

  it("sets the expiry date on the FIRST publication (Lot 265, audit A2: listings never expired before)", async () => {
    const before = Date.now();
    await POST(request({ action: "approve" }), { params });
    const { data } = updateManyListing.mock.calls[0][0];
    expect(data.status).toBe("PUBLIEE");
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(data.expiryReminderSentAt).toBeNull();
    const days = (data.expiresAt.getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1); // STANDARD : 30 jours
    expect(updateManyPaymentOrder).not.toHaveBeenCalled();
  });

  it("keeps the running expiry cycle on a re-approval after an edit (publishedAt already set)", async () => {
    findUniqueListing.mockResolvedValue({ ...LISTING_PENDING, publishedAt: new Date("2026-10-01T00:00:00Z") });
    await POST(request({ action: "approve" }), { params });
    const { data } = updateManyListing.mock.calls[0][0];
    expect(data).not.toHaveProperty("expiresAt");
    expect(data.publishedAt).toEqual(new Date("2026-10-01T00:00:00Z"));
  });

  it("rejects a pending listing when a reason is given, without notifying search alerts, and cancels its pending payment orders", async () => {
    const res = await POST(request({ action: "reject", reason: "Photos floues" }), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "REFUSEE" });
    expect(notifyMatchingSearchAlerts).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(updateManyPaymentOrder).toHaveBeenCalledOnce();
    expect(updateManyPaymentOrder.mock.calls[0][0]).toMatchObject({ where: { listingId: "listing-1", status: "EN_ATTENTE" }, data: { status: "ANNULEE", reviewNote: "listing_refusee" } });
  });

  it("returns 400 when rejecting without a reason (invalid transition from the logic layer)", async () => {
    // computeModerationTransition("EN_ATTENTE", "reject") → { ok: false, error: "reason_required" }
    const res = await POST(request({ action: "reject" }), { params });
    expect(res.status).toBe(400);
    expect(notifyMatchingSearchAlerts).not.toHaveBeenCalled();
  });

  it("suspends a published listing when a reason is given", async () => {
    findUniqueListing.mockResolvedValue(LISTING_PUBLISHED);
    const res = await POST(request({ action: "suspend", reason: "Signalement fraude" }), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "SUSPENDUE" });
    expect(notifyMatchingSearchAlerts).not.toHaveBeenCalled();
    // Lot 265 — une annonce suspendue ne doit pas être republiée par un paiement qui arriverait ensuite.
    expect(updateManyPaymentOrder.mock.calls[0][0].data.reviewNote).toBe("listing_suspendue");
  });

  it("returns 400 when the state machine rejects the transition (race condition guard)", async () => {
    updateManyListing.mockResolvedValue({ count: 0 });
    const res = await POST(request({ action: "approve" }), { params });
    expect(res.status).toBe(400);
  });

  it("records an audit log entry on every successful action", async () => {
    await POST(request({ action: "approve" }), { params });
    const call = writeAuditLog.mock.calls[0][0];
    expect(call.adminId).toBe(STAFF_USER.id);
    expect(call.action).toBe("listing.approve");
    expect(call.targetId).toBe("listing-1");
  });
});
