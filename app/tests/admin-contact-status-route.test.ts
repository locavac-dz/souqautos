// Lot 273 — POST /api/admin/contact/[id]/status : prise en charge, répondu, réouverture, journal.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { getCurrentUser, findUnique, updateMany, writeAuditLog } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { contactMessage: { findUnique: (...a: unknown[]) => findUnique(...a), updateMany: (...a: unknown[]) => updateMany(...a) } },
}));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));

import { POST } from "@/app/api/admin/contact/[id]/status/route";

const request = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;
const params = { params: Promise.resolve({ id: "cm1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({ id: "staff-1", role: "SUPPORT" });
  findUnique.mockResolvedValue({ status: "NOUVEAU", handledById: null });
  updateMany.mockResolvedValue({ count: 1 });
  writeAuditLog.mockResolvedValue(undefined);
});

describe("POST /api/admin/contact/[id]/status", () => {
  it("laisse toute l'équipe (SUPPORT compris) prendre en charge, et attribue le message", async () => {
    const res = await POST(request({ action: "take", note: "Je rappelle le client" }), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "PRIS_EN_CHARGE" });
    expect(updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "cm1", status: "NOUVEAU" },
      data: { status: "PRIS_EN_CHARGE", handledById: "staff-1", note: "Je rappelle le client" },
    });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ adminId: "staff-1", action: "contact.take", targetId: "cm1" }));
  });

  it("marque répondu avec la date, sans changer celui qui avait pris en charge", async () => {
    findUnique.mockResolvedValue({ status: "PRIS_EN_CHARGE", handledById: "staff-9" });
    await POST(request({ action: "answered" }), params);
    const { data } = updateMany.mock.calls[0][0];
    expect(data).toMatchObject({ status: "REPONDU", handledById: "staff-9" });
    expect(data.answeredAt).toBeInstanceOf(Date);
    expect(data).not.toHaveProperty("note");
  });

  it("refuse une transition sans sens et un anonyme", async () => {
    findUnique.mockResolvedValue({ status: "REPONDU", handledById: "staff-1" });
    expect((await POST(request({ action: "answered" }), params)).status).toBe(400);
    expect(updateMany).not.toHaveBeenCalled();

    getCurrentUser.mockResolvedValue(null);
    expect((await POST(request({ action: "take" }), params)).status).toBe(401);
  });

  it("répond 404 sur un message inconnu et 400 quand un collègue a tranché entre-temps", async () => {
    findUnique.mockResolvedValue(null);
    expect((await POST(request({ action: "take" }), params)).status).toBe(404);

    findUnique.mockResolvedValue({ status: "NOUVEAU", handledById: null });
    updateMany.mockResolvedValue({ count: 0 });
    expect((await POST(request({ action: "take" }), params)).status).toBe(400);
    expect(writeAuditLog).not.toHaveBeenCalled();
  });
});
