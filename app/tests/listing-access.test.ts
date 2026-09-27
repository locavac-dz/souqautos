import { beforeEach, describe, expect, it, vi } from "vitest";

const collaboratorFindFirst = vi.fn();
const collaboratorFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    proCollaborator: {
      findFirst: (...a: unknown[]) => collaboratorFindFirst(...a),
      findMany:  (...a: unknown[]) => collaboratorFindMany(...a),
    },
  },
}));

vi.mock("@/lib/pro-account", () => ({
  canManageProListings: ({ isOwner, permissions }: { isOwner: boolean; permissions: { gererAnnonces?: boolean } | null }) => {
    if (isOwner) return true;
    return permissions?.gererAnnonces === true;
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

import { canManageListing, canAccessConversation, getManageableSellerIds } from "@/lib/listing-access";

const SELLER_ID = "seller1";
const USER_ID   = "user1";
const COLLAB_ID = "collab1";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("canManageListing", () => {
  it("allows the owner", async () => {
    expect(await canManageListing(SELLER_ID, SELLER_ID)).toBe(true);
    expect(collaboratorFindFirst).not.toHaveBeenCalled();
  });

  it("allows a collaborator with gererAnnonces permission", async () => {
    collaboratorFindFirst.mockResolvedValue({
      userId: COLLAB_ID,
      permissions: JSON.stringify({ gererAnnonces: true }),
    });
    expect(await canManageListing(COLLAB_ID, SELLER_ID)).toBe(true);
  });

  it("denies a collaborator without gererAnnonces permission", async () => {
    collaboratorFindFirst.mockResolvedValue({
      userId: COLLAB_ID,
      permissions: JSON.stringify({ gererAnnonces: false }),
    });
    expect(await canManageListing(COLLAB_ID, SELLER_ID)).toBe(false);
  });

  it("denies a user with no collaboration record", async () => {
    collaboratorFindFirst.mockResolvedValue(null);
    expect(await canManageListing("stranger", SELLER_ID)).toBe(false);
  });
});

describe("canAccessConversation", () => {
  const conv = { buyerId: "buyer1", sellerId: SELLER_ID };

  it("allows the buyer", async () => {
    expect(await canAccessConversation("buyer1", conv)).toBe(true);
  });

  it("allows the seller", async () => {
    expect(await canAccessConversation(SELLER_ID, conv)).toBe(true);
  });

  it("allows a collaborator of the seller with gererAnnonces", async () => {
    collaboratorFindFirst.mockResolvedValue({
      userId: COLLAB_ID,
      permissions: JSON.stringify({ gererAnnonces: true }),
    });
    expect(await canAccessConversation(COLLAB_ID, conv)).toBe(true);
  });

  it("denies a stranger", async () => {
    collaboratorFindFirst.mockResolvedValue(null);
    expect(await canAccessConversation("stranger", conv)).toBe(false);
  });
});

describe("getManageableSellerIds", () => {
  it("always includes the caller's own id", async () => {
    collaboratorFindMany.mockResolvedValue([]);
    const ids = await getManageableSellerIds(USER_ID);
    expect(ids).toContain(USER_ID);
  });

  it("includes seller ids where the user has gererAnnonces", async () => {
    collaboratorFindMany.mockResolvedValue([
      {
        permissions: JSON.stringify({ gererAnnonces: true }),
        professionalAccount: { userId: SELLER_ID },
      },
    ]);
    const ids = await getManageableSellerIds(USER_ID);
    expect(ids).toEqual([USER_ID, SELLER_ID]);
  });

  it("excludes collaborations without gererAnnonces", async () => {
    collaboratorFindMany.mockResolvedValue([
      {
        permissions: JSON.stringify({ gererAnnonces: false }),
        professionalAccount: { userId: SELLER_ID },
      },
    ]);
    const ids = await getManageableSellerIds(USER_ID);
    expect(ids).toEqual([USER_ID]);
  });
});
