// Lot 275 — POST /api/admin/reports/weekly : ADMIN seulement, envoi forcé, journal.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, sendWeeklyReport, writeAuditLog } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  sendWeeklyReport: vi.fn(),
  writeAuditLog: vi.fn(),
}));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/weekly-report", () => ({ sendWeeklyReport: (...a: unknown[]) => sendWeeklyReport(...a) }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));

import { POST } from "@/app/api/admin/reports/weekly/route";

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
  sendWeeklyReport.mockResolvedValue({ status: "sent", periodStart: "2026-09-27T23:00:00.000Z", recipients: 2 });
  writeAuditLog.mockResolvedValue(undefined);
});

describe("POST /api/admin/reports/weekly", () => {
  it("force l'envoi du rapport de la dernière semaine complète et le journalise", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "sent", recipients: 2 });
    expect(sendWeeklyReport.mock.calls[0][1]).toEqual({ force: true });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ adminId: "admin-1", action: "weekly_report.send" }));
  });

  it("répond 409 sans destinataire, 403 à un modérateur", async () => {
    sendWeeklyReport.mockResolvedValue({ status: "no_recipients", periodStart: "x" });
    expect((await POST()).status).toBe(409);

    getCurrentUser.mockResolvedValue({ id: "m1", role: "MODERATEUR" });
    expect((await POST()).status).toBe(403);
  });
});
