import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const userFindUnique = vi.fn();
const userUpdate     = vi.fn();
const getCurrentUser = vi.fn();
const writeAuditLog  = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => userFindUnique(...a),
      update:     (...a: unknown[]) => userUpdate(...a),
    },
  },
}));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/auth-server/roles",        () => ({ isAdmin: (role: string) => role === "ADMIN" }));
vi.mock("@/lib/audit-log",               () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));

import { POST } from "@/app/api/admin/users/[id]/role/route";

const ADMIN = { id: "admin1", role: "ADMIN" };
const TARGET_ID = "user2";

function request(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}
function ctx(id = TARGET_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue(ADMIN);
  userFindUnique.mockResolvedValue({ id: TARGET_ID, role: "PARTICULIER" });
  userUpdate.mockResolvedValue({});
  writeAuditLog.mockResolvedValue(undefined);
});

describe("POST /api/admin/users/[id]/role", () => {
  it("returns 403 for unauthenticated requests", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(request({ role: "MODERATEUR" }), ctx());
    expect(res.status).toBe(403);
  });

  it("returns 403 for non-admin users", async () => {
    getCurrentUser.mockResolvedValue({ id: "user3", role: "PARTICULIER" });
    const res = await POST(request({ role: "MODERATEUR" }), ctx());
    expect(res.status).toBe(403);
  });

  it("prevents an admin from changing their own role", async () => {
    const res = await POST(request({ role: "PARTICULIER" }), ctx(ADMIN.id));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "cannot_change_own_role" });
  });

  it("returns 400 for invalid role values", async () => {
    const res = await POST(request({ role: "SUPERADMIN" }), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "validation" });
  });

  it("returns 404 when the target user does not exist", async () => {
    userFindUnique.mockResolvedValue(null);
    const res = await POST(request({ role: "MODERATEUR" }), ctx());
    expect(res.status).toBe(404);
  });

  it("updates the role and writes an audit log", async () => {
    const res = await POST(request({ role: "MODERATEUR" }), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).role).toBe("MODERATEUR");
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: TARGET_ID }, data: { role: "MODERATEUR" } });
    expect(writeAuditLog).toHaveBeenCalledOnce();
    const auditArg = writeAuditLog.mock.calls[0][0];
    expect(auditArg.action).toBe("user.role_change");
    expect(auditArg.details).toMatchObject({ previousRole: "PARTICULIER", newRole: "MODERATEUR" });
  });
});
