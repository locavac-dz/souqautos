import { beforeEach, describe, expect, it, vi } from "vitest";

const collaboratorFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    proCollaborator: {
      findFirst: (...a: unknown[]) => collaboratorFindFirst(...a),
    },
  },
}));

vi.mock("@/lib/pro-permissions", () => ({
  parseProPermissions: (raw: string) => {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  },
}));

import { resolveProAccess } from "@/lib/pro-access";
import type { ProfessionalAccount } from "@prisma/client";

const PRO_ACCOUNT = { id: "pro1", userId: "seller1" } as ProfessionalAccount;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("resolveProAccess", () => {
  it("returns owner access when the user owns a pro account", async () => {
    const user = { id: "seller1", professionalAccount: PRO_ACCOUNT };
    const result = await resolveProAccess(user);
    expect(result).not.toBeNull();
    expect(result!.account).toBe(PRO_ACCOUNT);
    expect(result!.access.isOwner).toBe(true);
    expect(result!.access.permissions).toBeNull();
    expect(collaboratorFindFirst).not.toHaveBeenCalled();
  });

  it("returns collaboration access for a collaborator", async () => {
    const user = { id: "collab1", professionalAccount: null };
    const permissions = JSON.stringify({ gererAnnonces: true });
    collaboratorFindFirst.mockResolvedValue({
      professionalAccount: PRO_ACCOUNT,
      permissions,
    });
    const result = await resolveProAccess(user);
    expect(result).not.toBeNull();
    expect(result!.account).toBe(PRO_ACCOUNT);
    expect(result!.access.isOwner).toBe(false);
    expect(result!.access.permissions).toEqual({ gererAnnonces: true });
  });

  it("returns null when user has no pro link at all", async () => {
    const user = { id: "regular", professionalAccount: null };
    collaboratorFindFirst.mockResolvedValue(null);
    const result = await resolveProAccess(user);
    expect(result).toBeNull();
  });
});
