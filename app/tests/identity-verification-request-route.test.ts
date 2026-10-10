// Lot 168 (confirmé) — la vérification d'identité est réservée aux comptes professionnels (et à l'équipe) :
// aucun particulier ne doit pouvoir soumettre de pièce d'identité. Ce test verrouille cette règle contre
// une régression future (aucun test de route ne la couvrait jusqu'ici).
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { getCurrentUser, checkRateLimit, findFirst, create, saveIdentityDocument, notifyStaffOfPending, afterCallbacks } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  checkRateLimit: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  saveIdentityDocument: vi.fn(),
  notifyStaffOfPending: vi.fn(),
  afterCallbacks: [] as Array<() => Promise<void> | void>,
}));

vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: { identityVerificationRequest: { findFirst: (...a: unknown[]) => findFirst(...a), create: (...a: unknown[]) => create(...a) } },
}));
vi.mock("@/lib/identity-uploads", () => ({
  saveIdentityDocument: (...a: unknown[]) => saveIdentityDocument(...a),
  DocumentValidationError: class DocumentValidationError extends Error {},
}));
vi.mock("@/lib/staff-alerts", () => ({ notifyStaffOfPending: (...a: unknown[]) => notifyStaffOfPending(...a) }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => Promise<void> | void) => void afterCallbacks.push(fn),
}));

import { POST } from "@/app/api/identity-verification/request/route";

function request(): NextRequest {
  const formData = new FormData();
  formData.set("document", new File(["x"], "piece.jpg", { type: "image/jpeg" }));
  return { formData: async () => formData } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  afterCallbacks.length = 0;
  checkRateLimit.mockResolvedValue(true);
  findFirst.mockResolvedValue(null);
  create.mockResolvedValue({ id: "req1" });
  saveIdentityDocument.mockResolvedValue({ filename: "piece.enc", mime: "image/jpeg" });
});

describe("POST /api/identity-verification/request — réservé aux pros et à l'équipe", () => {
  it("refuse un particulier (403)", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "PARTICULIER", identityVerifiedAt: null });
    const res = await POST(request());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuse un anonyme (401)", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("laisse passer un compte professionnel", async () => {
    getCurrentUser.mockResolvedValue({ id: "u2", role: "PROFESSIONNEL", identityVerifiedAt: null });
    const res = await POST(request());
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledOnce();
  });

  it("laisse passer un membre de l'équipe (modérateur, admin, super admin)", async () => {
    for (const role of ["MODERATEUR", "ADMIN", "SUPER_ADMIN"] as const) {
      getCurrentUser.mockResolvedValue({ id: "u3", role, identityVerifiedAt: null });
      const res = await POST(request());
      expect(res.status).toBe(201);
    }
  });
});
