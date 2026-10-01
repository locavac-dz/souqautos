import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const getCurrentUser = vi.fn();
const isStaff = vi.fn();
const findUniqueReport = vi.fn();
const updateReport = vi.fn();
const countReports = vi.fn();
const updateListing = vi.fn();
const findUniqueUser = vi.fn();
const updateUser = vi.fn();
const updateOwnerReview = vi.fn();
const getModerationSettings = vi.fn();
const sendEmail = vi.fn();
const sendAccountSuspendedEmail = vi.fn();
const sendOwnerReviewDecisionEmail = vi.fn();
const writeAuditLog = vi.fn();

vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/auth-server/roles", () => ({ isStaff: (role: string) => isStaff(role) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    report: { findUnique: (...a: unknown[]) => findUniqueReport(...a), update: (...a: unknown[]) => updateReport(...a), count: (...a: unknown[]) => countReports(...a) },
    listing: { update: (...a: unknown[]) => updateListing(...a) },
    user: { findUnique: (...a: unknown[]) => findUniqueUser(...a), update: (...a: unknown[]) => updateUser(...a) },
    ownerReview: { update: (...a: unknown[]) => updateOwnerReview(...a) },
  },
}));
vi.mock("@/lib/moderation-settings", () => ({ getModerationSettings: () => getModerationSettings() }));
vi.mock("@/lib/mailer", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a), escapeHtml: (s: string) => s }));
vi.mock("@/lib/account-suspension-email", () => ({ sendAccountSuspendedEmail: (...a: unknown[]) => sendAccountSuspendedEmail(...a) }));
vi.mock("@/lib/owner-review-email", () => ({ sendOwnerReviewDecisionEmail: (...a: unknown[]) => sendOwnerReviewDecisionEmail(...a) }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));
vi.mock("@/lib/owner-review", () => ({ removedAfterReportUpdate: () => ({ status: "RETIRE", removedAt: new Date() }) }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));

import { POST } from "@/app/api/admin/reports/[id]/resolve/route";

const STAFF_USER = { id: "staff-1", role: "ADMIN" };
const REPORT_LISTING = { id: "report-1", status: "OUVERT", author: { id: "user-1", email: "user@example.dz", locale: "fr" }, listingId: "listing-1", listing: { id: "listing-1", title: "Clio", status: "PUBLIEE" }, reportedUserId: null, ownerReviewId: null, ownerReview: null };
const REPORT_USER = { ...REPORT_LISTING, listingId: null, listing: null, reportedUserId: "target-1" };
const REPORT_OWNER_REVIEW = { ...REPORT_LISTING, listingId: null, listing: null, ownerReviewId: "review-1", ownerReview: { id: "review-1", status: "PUBLIE" } };
const SETTINGS_NO_AUTO = { autoSuspendListingThreshold: 999, autoSuspendUserThreshold: 999 };

function request(body: unknown): NextRequest {
  return { json: async () => body, headers: { get: () => null } } as unknown as NextRequest;
}

const params = Promise.resolve({ id: "report-1" });

beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue(STAFF_USER);
  isStaff.mockReset().mockImplementation((role: string) => role === "ADMIN" || role === "MODERATEUR");
  findUniqueReport.mockReset().mockResolvedValue(REPORT_LISTING);
  updateReport.mockReset().mockResolvedValue({});
  countReports.mockReset().mockResolvedValue(0);
  updateListing.mockReset().mockResolvedValue({});
  findUniqueUser.mockReset().mockResolvedValue(null);
  updateUser.mockReset().mockResolvedValue({});
  updateOwnerReview.mockReset().mockResolvedValue({});
  getModerationSettings.mockReset().mockResolvedValue(SETTINGS_NO_AUTO);
  sendEmail.mockReset().mockResolvedValue(null);
  sendAccountSuspendedEmail.mockReset().mockResolvedValue(undefined);
  sendOwnerReviewDecisionEmail.mockReset().mockResolvedValue(undefined);
  writeAuditLog.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/admin/reports/[id]/resolve", () => {
  it("returns 403 when not authenticated", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await POST(request({ action: "resolve" }), { params })).status).toBe(403);
    expect(findUniqueReport).not.toHaveBeenCalled();
  });

  it("returns 403 when authenticated but not staff", async () => {
    isStaff.mockReturnValue(false);
    expect((await POST(request({ action: "resolve" }), { params })).status).toBe(403);
  });

  it("returns 400 on an invalid action", async () => {
    expect((await POST(request({ action: "delete" }), { params })).status).toBe(400);
    expect(findUniqueReport).not.toHaveBeenCalled();
  });

  it("returns 404 when the report does not exist", async () => {
    findUniqueReport.mockResolvedValue(null);
    expect((await POST(request({ action: "resolve" }), { params })).status).toBe(404);
  });

  it("resolves an open report and notifies the author", async () => {
    const res = await POST(request({ action: "resolve" }), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "TRAITE" });
    expect(updateReport).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(writeAuditLog).toHaveBeenCalledOnce();
  });

  it("dismisses an open report and notifies the author", async () => {
    const res = await POST(request({ action: "dismiss" }), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "REJETE" });
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("returns 400 when the report is already resolved (invalid transition)", async () => {
    findUniqueReport.mockResolvedValue({ ...REPORT_LISTING, status: "TRAITE" });
    const res = await POST(request({ action: "resolve" }), { params });
    expect(res.status).toBe(400);
    expect(updateReport).not.toHaveBeenCalled();
  });

  describe("auto-suspension de l'annonce", () => {
    it("suspends the listing when the threshold is reached on resolve", async () => {
      getModerationSettings.mockResolvedValue({ autoSuspendListingThreshold: 3, autoSuspendUserThreshold: 999 });
      countReports.mockResolvedValue(3); // exactly at threshold
      await POST(request({ action: "resolve" }), { params });
      expect(updateListing).toHaveBeenCalledOnce();
      expect(writeAuditLog).toHaveBeenCalledTimes(2); // report + listing.auto_suspend
    });

    it("does not suspend the listing below the threshold", async () => {
      getModerationSettings.mockResolvedValue({ autoSuspendListingThreshold: 3, autoSuspendUserThreshold: 999 });
      countReports.mockResolvedValue(2);
      await POST(request({ action: "resolve" }), { params });
      expect(updateListing).not.toHaveBeenCalled();
    });

    it("does not suspend on dismiss (only confirmed reports count)", async () => {
      getModerationSettings.mockResolvedValue({ autoSuspendListingThreshold: 1, autoSuspendUserThreshold: 999 });
      countReports.mockResolvedValue(5);
      await POST(request({ action: "dismiss" }), { params });
      expect(updateListing).not.toHaveBeenCalled();
    });
  });

  describe("auto-suspension de l'utilisateur", () => {
    it("suspends the user when the threshold is reached on resolve", async () => {
      findUniqueReport.mockResolvedValue(REPORT_USER);
      getModerationSettings.mockResolvedValue({ autoSuspendListingThreshold: 999, autoSuspendUserThreshold: 2 });
      countReports.mockResolvedValue(2);
      findUniqueUser.mockResolvedValue({ id: "target-1", role: "USER", suspendedAt: null });
      await POST(request({ action: "resolve" }), { params });
      expect(updateUser).toHaveBeenCalledOnce();
      expect(sendAccountSuspendedEmail).toHaveBeenCalledOnce();
    });

    it("never suspends a staff member automatically", async () => {
      findUniqueReport.mockResolvedValue(REPORT_USER);
      getModerationSettings.mockResolvedValue({ autoSuspendListingThreshold: 999, autoSuspendUserThreshold: 1 });
      countReports.mockResolvedValue(5);
      findUniqueUser.mockResolvedValue({ id: "target-1", role: "MODERATEUR", suspendedAt: null });
      await POST(request({ action: "resolve" }), { params });
      expect(updateUser).not.toHaveBeenCalled();
      expect(sendAccountSuspendedEmail).not.toHaveBeenCalled();
    });

    it("does not suspend an already-suspended user", async () => {
      findUniqueReport.mockResolvedValue(REPORT_USER);
      getModerationSettings.mockResolvedValue({ autoSuspendListingThreshold: 999, autoSuspendUserThreshold: 1 });
      countReports.mockResolvedValue(5);
      findUniqueUser.mockResolvedValue({ id: "target-1", role: "USER", suspendedAt: new Date() });
      await POST(request({ action: "resolve" }), { params });
      expect(updateUser).not.toHaveBeenCalled();
    });
  });

  describe("signalement d'un avis de propriétaire", () => {
    it("removes the owner review when the report is confirmed", async () => {
      findUniqueReport.mockResolvedValue(REPORT_OWNER_REVIEW);
      await POST(request({ action: "resolve" }), { params });
      expect(updateOwnerReview).toHaveBeenCalledOnce();
      expect(sendOwnerReviewDecisionEmail).toHaveBeenCalledWith("review-1", "removed");
    });

    it("does not touch the owner review on dismiss", async () => {
      findUniqueReport.mockResolvedValue(REPORT_OWNER_REVIEW);
      await POST(request({ action: "dismiss" }), { params });
      expect(updateOwnerReview).not.toHaveBeenCalled();
    });
  });
});
