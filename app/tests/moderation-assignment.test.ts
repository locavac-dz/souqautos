// Lot 277 — affectation dans la file : règle pure, orchestration avec course, activité de l'équipe, route.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { listingFindUnique, listingUpdateMany, reportFindUnique, reportUpdateMany, writeAuditLog, getCurrentUser } = vi.hoisted(() => ({
  listingFindUnique: vi.fn(),
  listingUpdateMany: vi.fn(),
  reportFindUnique: vi.fn(),
  reportUpdateMany: vi.fn(),
  writeAuditLog: vi.fn(),
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: { findUnique: (...a: unknown[]) => listingFindUnique(...a), updateMany: (...a: unknown[]) => listingUpdateMany(...a) },
    report: { findUnique: (...a: unknown[]) => reportFindUnique(...a), updateMany: (...a: unknown[]) => reportUpdateMany(...a) },
  },
}));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));

import { assignModerationItem, decideAssignment, summarizeTeamActivity } from "@/lib/moderation-assignment";
import { POST } from "@/app/api/admin/listings/[id]/assign/route";

const NOW = new Date("2026-10-09T10:00:00Z");
const SUPPORT = { id: "s1", role: "SUPPORT" as const };
const ADMIN = { id: "a1", role: "ADMIN" as const };

describe("decideAssignment", () => {
  it("prend en charge un élément libre, sous condition qu'il le soit encore", () => {
    expect(decideAssignment({ action: "take", currentAssigneeId: null, user: SUPPORT, now: NOW })).toEqual({
      ok: true,
      data: { assignedToId: "s1", assignedAt: NOW },
      where: { assignedToId: null },
    });
  });

  it("refuse de prendre ce qu'un collègue (ou soi-même) tient déjà", () => {
    expect(decideAssignment({ action: "take", currentAssigneeId: "x", user: SUPPORT, now: NOW })).toEqual({ ok: false, error: "already_assigned" });
    expect(decideAssignment({ action: "take", currentAssigneeId: "s1", user: SUPPORT, now: NOW })).toEqual({ ok: false, error: "already_assigned" });
  });

  it("libère : soi-même ou un ADMIN, jamais un collègue", () => {
    expect(decideAssignment({ action: "release", currentAssigneeId: "s1", user: SUPPORT, now: NOW })).toEqual({
      ok: true,
      data: { assignedToId: null, assignedAt: null },
      where: { assignedToId: "s1" },
    });
    expect(decideAssignment({ action: "release", currentAssigneeId: "s1", user: ADMIN, now: NOW }).ok).toBe(true);
    expect(decideAssignment({ action: "release", currentAssigneeId: "x", user: SUPPORT, now: NOW })).toEqual({ ok: false, error: "forbidden" });
    expect(decideAssignment({ action: "release", currentAssigneeId: null, user: SUPPORT, now: NOW })).toEqual({ ok: false, error: "not_assigned" });
  });
});

describe("assignModerationItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listingFindUnique.mockResolvedValue({ assignedToId: null });
    listingUpdateMany.mockResolvedValue({ count: 1 });
    reportFindUnique.mockResolvedValue({ assignedToId: null });
    reportUpdateMany.mockResolvedValue({ count: 1 });
    writeAuditLog.mockResolvedValue(undefined);
  });

  it("écrit atomiquement (where « encore libre ») et journalise", async () => {
    expect(await assignModerationItem({ kind: "listing", id: "l1", action: "take", user: SUPPORT, now: NOW })).toEqual({ ok: true, assignedToId: "s1" });
    expect(listingUpdateMany).toHaveBeenCalledWith({ where: { id: "l1", assignedToId: null }, data: { assignedToId: "s1", assignedAt: NOW } });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ adminId: "s1", action: "listing.assign", targetType: "Listing", targetId: "l1" }));
  });

  it("perd la course sans journaliser, et fonctionne pour les signalements", async () => {
    listingUpdateMany.mockResolvedValue({ count: 0 });
    expect(await assignModerationItem({ kind: "listing", id: "l1", action: "take", user: SUPPORT })).toEqual({ ok: false, error: "race_lost" });
    expect(writeAuditLog).not.toHaveBeenCalled();

    reportFindUnique.mockResolvedValue({ assignedToId: "s1" });
    expect(await assignModerationItem({ kind: "report", id: "r1", action: "release", user: SUPPORT, now: NOW })).toEqual({ ok: true, assignedToId: null });
    expect(reportUpdateMany.mock.calls[0][0]).toEqual({ where: { id: "r1", assignedToId: "s1" }, data: { assignedToId: null, assignedAt: null } });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "report.release", targetType: "Report" }));
  });

  it("répond not_found sur un élément inconnu", async () => {
    listingFindUnique.mockResolvedValue(null);
    expect(await assignModerationItem({ kind: "listing", id: "nope", action: "take", user: SUPPORT })).toEqual({ ok: false, error: "not_found" });
  });
});

describe("summarizeTeamActivity", () => {
  it("compte les décisions par membre, calcule le délai moyen des annonces et ajoute les éléments en cours", () => {
    const d = (h: number) => new Date(NOW.getTime() + h * 3_600_000);
    const rows = summarizeTeamActivity({
      logs: [
        { adminId: "a1", action: "listing.approve", targetId: "l1", createdAt: d(0) },
        { adminId: "a1", action: "listing.reject", targetId: "l2", createdAt: d(1) },
        { adminId: "a1", action: "report.resolve", targetId: "r1", createdAt: d(1) },
        { adminId: "s1", action: "listing.approve", targetId: "l3", createdAt: d(2) },
        { adminId: null, action: "listing.auto_publish", targetId: "l9", createdAt: d(2) },
        { adminId: "s1", action: "user.role_change", targetId: "u1", createdAt: d(2) },
      ],
      listingCreatedAt: new Map([["l1", d(-4)], ["l2", d(-1)], ["l3", d(-10)]]),
      emails: new Map([["a1", "admin@souqauto.dz"], ["s1", "support@souqauto.dz"]]),
      inProgressByAdmin: new Map([["s1", 2], ["m9", 1]]),
    });
    expect(rows).toEqual([
      { adminId: "a1", email: "admin@souqauto.dz", listings: 2, reports: 1, avgListingDelayHours: 3, inProgress: 0 },
      { adminId: "s1", email: "support@souqauto.dz", listings: 1, reports: 0, avgListingDelayHours: 12, inProgress: 2 },
      { adminId: "m9", email: "m9", listings: 0, reports: 0, avgListingDelayHours: null, inProgress: 1 },
    ]);
  });
});

describe("POST /api/admin/listings/[id]/assign", () => {
  const request = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;
  const params = { params: Promise.resolve({ id: "l1" }) };

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(SUPPORT);
    listingFindUnique.mockResolvedValue({ assignedToId: null });
    listingUpdateMany.mockResolvedValue({ count: 1 });
    writeAuditLog.mockResolvedValue(undefined);
  });

  it("laisse tout membre de l'équipe prendre en charge ; 409 si déjà pris ; 403 à un anonyme", async () => {
    const ok = await POST(request({ action: "take" }), params);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ assignedToId: "s1" });

    listingFindUnique.mockResolvedValue({ assignedToId: "x" });
    expect((await POST(request({ action: "take" }), params)).status).toBe(409);
    expect((await POST(request({ action: "release" }), params)).status).toBe(403);

    getCurrentUser.mockResolvedValue(null);
    expect((await POST(request({ action: "take" }), params)).status).toBe(403);
  });
});
