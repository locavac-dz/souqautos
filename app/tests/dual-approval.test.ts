// Lot 278 — double validation des gros virements : règles pures, puis la route de revue d'une formule d'annonce.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { getCurrentUser, findUnique, updateMany, confirmOrder, sendDecisionEmail, checkProvider, recordPaymentEvent, writeAuditLog, getPaymentSettings } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  confirmOrder: vi.fn(),
  sendDecisionEmail: vi.fn(),
  checkProvider: vi.fn(),
  recordPaymentEvent: vi.fn(),
  writeAuditLog: vi.fn(),
  getPaymentSettings: vi.fn(),
}));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/prisma", () => ({ prisma: { paymentOrder: { findUnique: (...a: unknown[]) => findUnique(...a), updateMany: (...a: unknown[]) => updateMany(...a) } } }));
vi.mock("@/lib/payment-fulfillment", () => ({
  confirmListingFormulaOrder: (...a: unknown[]) => confirmOrder(...a),
  sendListingFormulaDecisionEmail: (...a: unknown[]) => sendDecisionEmail(...a),
}));
vi.mock("@/lib/admin-payment-decision", () => ({ checkProviderBeforeDecision: (...a: unknown[]) => checkProvider(...a) }));
vi.mock("@/lib/payment-events", () => ({ recordPaymentEvent: (...a: unknown[]) => recordPaymentEvent(...a) }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));
vi.mock("@/lib/payment-settings", () => ({ getPaymentSettings: () => getPaymentSettings() }));

import { decideApprovalStep, dualApprovalBlocksAlone, requiresDualApproval, validateDualApprovalThreshold } from "@/lib/dual-approval";
import { POST } from "@/app/api/admin/payment-orders/[id]/review/route";

describe("requiresDualApproval", () => {
  it("s'applique aux virements au-dessus (ou égal) du seuil, jamais aux paiements en ligne ni sans seuil", () => {
    expect(requiresDualApproval({ amountDzd: 12000, provider: "VIREMENT", thresholdDzd: 10000 })).toBe(true);
    expect(requiresDualApproval({ amountDzd: 10000, provider: "VIREMENT", thresholdDzd: 10000 })).toBe(true);
    expect(requiresDualApproval({ amountDzd: 9999, provider: "VIREMENT", thresholdDzd: 10000 })).toBe(false);
    expect(requiresDualApproval({ amountDzd: 50000, provider: "CHARGILY", thresholdDzd: 10000 })).toBe(false);
    expect(requiresDualApproval({ amountDzd: 50000, provider: "VIREMENT", thresholdDzd: null })).toBe(false);
  });
});

describe("decideApprovalStep", () => {
  it("première validation, puis confirmation par une AUTRE personne", () => {
    expect(decideApprovalStep({ requiresDual: false, firstApprovedById: null, userId: "a1" })).toBe("confirm");
    expect(decideApprovalStep({ requiresDual: true, firstApprovedById: null, userId: "a1" })).toBe("first_approval");
    expect(decideApprovalStep({ requiresDual: true, firstApprovedById: "a1", userId: "a1" })).toBe("same_approver");
    expect(decideApprovalStep({ requiresDual: true, firstApprovedById: "a1", userId: "a2" })).toBe("confirm");
  });
});

describe("validateDualApprovalThreshold / dualApprovalBlocksAlone", () => {
  it("accepte null (désactivé) et un entier dans les bornes", () => {
    expect(validateDualApprovalThreshold(null)).toEqual({ ok: true });
    expect(validateDualApprovalThreshold(5000)).toEqual({ ok: true });
    expect(validateDualApprovalThreshold(0)).toEqual({ ok: false, error: "invalid_dual_approval_threshold" });
    expect(validateDualApprovalThreshold(2.5)).toEqual({ ok: false, error: "invalid_dual_approval_threshold" });
    expect(validateDualApprovalThreshold(100_000_001)).toEqual({ ok: false, error: "invalid_dual_approval_threshold" });
  });

  it("signale un seuil qui bloquerait un administrateur seul", () => {
    expect(dualApprovalBlocksAlone({ thresholdDzd: 5000, adminCount: 1 })).toBe(true);
    expect(dualApprovalBlocksAlone({ thresholdDzd: 5000, adminCount: 2 })).toBe(false);
    expect(dualApprovalBlocksAlone({ thresholdDzd: null, adminCount: 1 })).toBe(false);
  });
});

describe("POST /api/admin/payment-orders/[id]/review avec double validation", () => {
  const request = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;
  const params = { params: Promise.resolve({ id: "o1" }) };
  const ORDER = { id: "o1", status: "EN_ATTENTE", provider: "VIREMENT", amountDzd: 12000, formula: "PREMIUM", reference: "VIR-1", listingId: "l1", firstApprovedById: null, listing: { status: "PUBLIEE" }, user: { email: "k@example.dz", locale: "fr" } };

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: "a1", role: "ADMIN" });
    findUnique.mockResolvedValue(ORDER);
    updateMany.mockResolvedValue({ count: 1 });
    confirmOrder.mockResolvedValue("confirmed");
    checkProvider.mockResolvedValue({ ok: true, providerStatus: null });
    recordPaymentEvent.mockResolvedValue(undefined);
    writeAuditLog.mockResolvedValue(undefined);
    getPaymentSettings.mockResolvedValue({ dualApprovalThresholdDzd: 10000 });
  });

  it("première approbation au-dessus du seuil : enregistrée, commande toujours en attente, rien n'est activé", async () => {
    const res = await POST(request({ action: "approve" }), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "EN_ATTENTE", awaitingSecondApproval: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "o1", status: "EN_ATTENTE", firstApprovedById: null },
      data: { firstApprovedById: "a1", firstApprovedAt: expect.any(Date) },
    });
    expect(confirmOrder).not.toHaveBeenCalled();
    expect(recordPaymentEvent).toHaveBeenCalledWith(expect.objectContaining({ outcome: "first_approval", actorUserId: "a1" }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "payment_order.first_approve" }));
  });

  it("la même personne ne peut pas donner la seconde validation (409)", async () => {
    findUnique.mockResolvedValue({ ...ORDER, firstApprovedById: "a1" });
    const res = await POST(request({ action: "approve" }), params);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "second_approver_required" });
    expect(confirmOrder).not.toHaveBeenCalled();
  });

  it("un autre administrateur confirme : activation", async () => {
    findUnique.mockResolvedValue({ ...ORDER, firstApprovedById: "a1" });
    getCurrentUser.mockResolvedValue({ id: "a2", role: "ADMIN" });
    const res = await POST(request({ action: "approve" }), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "CONFIRMEE" });
    expect(confirmOrder).toHaveBeenCalledWith("o1", expect.any(Date), { kind: "admin", adminId: "a2", note: null });
  });

  it("sous le seuil, sans seuil ou en ligne : une seule approbation suffit ; le refus reste à une personne", async () => {
    findUnique.mockResolvedValue({ ...ORDER, amountDzd: 1000 });
    expect(await (await POST(request({ action: "approve" }), params)).json()).toEqual({ status: "CONFIRMEE" });

    getPaymentSettings.mockResolvedValue({ dualApprovalThresholdDzd: null });
    findUnique.mockResolvedValue(ORDER);
    expect(await (await POST(request({ action: "approve" }), params)).json()).toEqual({ status: "CONFIRMEE" });

    getPaymentSettings.mockResolvedValue({ dualApprovalThresholdDzd: 10000 });
    sendDecisionEmail.mockResolvedValue(undefined);
    expect(await (await POST(request({ action: "reject", reason: "Virement introuvable" }), params)).json()).toEqual({ status: "REJETEE" });
    expect(confirmOrder).toHaveBeenCalledTimes(2);
  });

  it("une première validation perdue de justesse (course) répond 400 sans rien activer", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    expect((await POST(request({ action: "approve" }), params)).status).toBe(400);
    expect(confirmOrder).not.toHaveBeenCalled();
  });
});
