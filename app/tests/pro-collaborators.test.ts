import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const proAccountFindUnique = vi.fn();
const userFindUnique       = vi.fn();
const collaboratorFindUnique = vi.fn();
const collaboratorCreate   = vi.fn();
const getCurrentUser       = vi.fn();
const checkRateLimit       = vi.fn();
const canManageCollaborators = vi.fn();
const serializeProPermissions = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    professionalAccount: { findUnique: (...a: unknown[]) => proAccountFindUnique(...a) },
    user:                { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    proCollaborator: {
      findUnique: (...a: unknown[]) => collaboratorFindUnique(...a),
      create:     (...a: unknown[]) => collaboratorCreate(...a),
    },
  },
}));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/rate-limit",               () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/pro-account",              () => ({ canManageCollaborators: (...a: unknown[]) => canManageCollaborators(...a) }));
vi.mock("@/lib/pro-permissions",          () => ({ serializeProPermissions: (...a: unknown[]) => serializeProPermissions(...a) }));
vi.mock("@/lib/prisma-errors",            () => ({ isUniqueViolation: () => false }));

import { POST } from "@/app/api/pro/accounts/[id]/collaborators/route";

const OWNER = { id: "owner1" };
const PRO_ACCOUNT = { id: "pro1", userId: "owner1" };
const TARGET_USER = { id: "target1", email: "collab@example.dz" };

function request(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}
function ctx(id = "pro1") {
  return { params: Promise.resolve({ id }) };
}

const VALID_BODY = { email: "collab@example.dz", permissions: { gererAnnonces: true, repondreAvis: false } };

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue(OWNER);
  checkRateLimit.mockResolvedValue(true);
  proAccountFindUnique.mockResolvedValue(PRO_ACCOUNT);
  canManageCollaborators.mockReturnValue(true);
  userFindUnique.mockResolvedValue(TARGET_USER);
  collaboratorFindUnique.mockResolvedValue(null);
  collaboratorCreate.mockResolvedValue({});
  serializeProPermissions.mockReturnValue("{}");
});

describe("POST /api/pro/accounts/[id]/collaborators", () => {
  it("rejects unauthenticated requests", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(request(VALID_BODY), ctx());
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    checkRateLimit.mockResolvedValue(false);
    const res = await POST(request(VALID_BODY), ctx());
    expect(res.status).toBe(429);
  });

  it("returns 404 when pro account does not exist", async () => {
    proAccountFindUnique.mockResolvedValue(null);
    const res = await POST(request(VALID_BODY), ctx());
    expect(res.status).toBe(404);
  });

  it("returns 403 when the user cannot manage collaborators", async () => {
    canManageCollaborators.mockReturnValue(false);
    const res = await POST(request(VALID_BODY), ctx());
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid payload (missing email)", async () => {
    const res = await POST(request({ permissions: { gererAnnonces: false, repondreAvis: false } }), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "validation" });
  });

  it("returns 404 when target user does not exist", async () => {
    userFindUnique.mockResolvedValue(null);
    const res = await POST(request(VALID_BODY), ctx());
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "user_not_found" });
  });

  it("returns 400 when owner tries to add themselves as collaborator", async () => {
    userFindUnique.mockResolvedValue({ ...TARGET_USER, id: OWNER.id });
    const res = await POST(request(VALID_BODY), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "cannot_add_self" });
  });

  it("returns 400 when the user is already a collaborator", async () => {
    collaboratorFindUnique.mockResolvedValue({ id: "existing" });
    const res = await POST(request(VALID_BODY), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "already_collaborator" });
  });

  it("creates the collaborator and returns 201 on success", async () => {
    const res = await POST(request(VALID_BODY), ctx());
    expect(res.status).toBe(201);
    expect(collaboratorCreate).toHaveBeenCalledOnce();
  });
});
