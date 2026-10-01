import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const getCurrentUser = vi.fn();
const isStaff = vi.fn();
const findUniqueReview = vi.fn();
const updateManyReview = vi.fn();
const sendOwnerReviewDecisionEmail = vi.fn();
const writeAuditLog = vi.fn();

vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/auth-server/roles", () => ({ isStaff: (role: string) => isStaff(role) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    ownerReview: { findUnique: (...a: unknown[]) => findUniqueReview(...a), updateMany: (...a: unknown[]) => updateManyReview(...a) },
  },
}));
vi.mock("@/lib/owner-review-email", () => ({ sendOwnerReviewDecisionEmail: (...a: unknown[]) => sendOwnerReviewDecisionEmail(...a) }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));

import { POST } from "@/app/api/admin/owner-reviews/[id]/moderate/route";

const STAFF_USER = { id: "staff-1", role: "MODERATEUR" };
const REVIEW_PENDING = { id: "review-1", status: "EN_ATTENTE", modelId: "model-42" };

function request(body: unknown): NextRequest {
  return { json: async () => body, headers: { get: () => null } } as unknown as NextRequest;
}

const params = Promise.resolve({ id: "review-1" });

beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue(STAFF_USER);
  isStaff.mockReset().mockReturnValue(true);
  findUniqueReview.mockReset().mockResolvedValue(REVIEW_PENDING);
  updateManyReview.mockReset().mockResolvedValue({ count: 1 });
  sendOwnerReviewDecisionEmail.mockReset().mockResolvedValue(undefined);
  writeAuditLog.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/admin/owner-reviews/[id]/moderate", () => {
  it("returns 403 when not authenticated", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await POST(request({ action: "approve" }), { params })).status).toBe(403);
    expect(findUniqueReview).not.toHaveBeenCalled();
  });

  it("returns 403 when authenticated but not staff", async () => {
    isStaff.mockReturnValue(false);
    expect((await POST(request({ action: "approve" }), { params })).status).toBe(403);
  });

  it("returns 400 on an invalid action", async () => {
    expect((await POST(request({ action: "delete" }), { params })).status).toBe(400);
    expect(findUniqueReview).not.toHaveBeenCalled();
  });

  it("returns 404 when the review does not exist", async () => {
    findUniqueReview.mockResolvedValue(null);
    expect((await POST(request({ action: "approve" }), { params })).status).toBe(404);
  });

  it("approves a pending review and sends the decision email", async () => {
    const res = await POST(request({ action: "approve" }), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "PUBLIE" });
    expect(sendOwnerReviewDecisionEmail).toHaveBeenCalledWith("review-1", "approved");
    expect(writeAuditLog).toHaveBeenCalledOnce();
  });

  it("rejects a pending review when a reason is given", async () => {
    const res = await POST(request({ action: "reject", reason: "Contenu inapproprié" }), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "REFUSE" });
    expect(sendOwnerReviewDecisionEmail).toHaveBeenCalledWith("review-1", "rejected");
  });

  it("returns 400 when rejecting without a reason", async () => {
    const res = await POST(request({ action: "reject" }), { params });
    expect(res.status).toBe(400);
    expect(sendOwnerReviewDecisionEmail).not.toHaveBeenCalled();
  });

  it("returns 409 when another moderator already acted (race condition guard)", async () => {
    updateManyReview.mockResolvedValue({ count: 0 });
    const res = await POST(request({ action: "approve" }), { params });
    expect(res.status).toBe(409);
    expect(sendOwnerReviewDecisionEmail).not.toHaveBeenCalled();
  });

  it("records an audit log entry with the moderator id and action", async () => {
    await POST(request({ action: "approve" }), { params });
    const call = writeAuditLog.mock.calls[0][0];
    expect(call.adminId).toBe(STAFF_USER.id);
    expect(call.action).toBe("owner_review.approve");
    expect(call.targetId).toBe("review-1");
  });
});
