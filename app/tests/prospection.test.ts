// Lot 274 — liste de prospection : classement des comptes pro et assemblage des listes.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listingGroupBy, userFindMany, accountFindMany } = vi.hoisted(() => ({
  listingGroupBy: vi.fn(),
  userFindMany: vi.fn(),
  accountFindMany: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: { groupBy: (...a: unknown[]) => listingGroupBy(...a) },
    user: { findMany: (...a: unknown[]) => userFindMany(...a) },
    professionalAccount: { findMany: (...a: unknown[]) => accountFindMany(...a) },
  },
}));

import { buildProspectionLists, classifyProAccount, PROSPECT_MIN_LISTINGS } from "@/lib/prospection";

const NOW = new Date("2026-10-09T08:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

describe("classifyProAccount", () => {
  it("sans abonnement, Starter ou expiré → à démarcher ; sous 15 jours → à relancer ; sinon actif", () => {
    expect(classifyProAccount({ tier: null, expiresAt: null, now: NOW })).toBe("no_subscription");
    expect(classifyProAccount({ tier: "STARTER", expiresAt: null, now: NOW })).toBe("no_subscription");
    expect(classifyProAccount({ tier: "PRO", expiresAt: days(-1), now: NOW })).toBe("no_subscription");
    expect(classifyProAccount({ tier: "PRO", expiresAt: days(10), now: NOW })).toBe("expiring");
    expect(classifyProAccount({ tier: "BUSINESS", expiresAt: days(25), now: NOW })).toBe("active");
  });
});

describe("buildProspectionLists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listingGroupBy
      .mockResolvedValueOnce([{ sellerId: "u1", _count: { _all: 7 }, _max: { createdAt: days(-2) } }])
      .mockResolvedValueOnce([{ sellerId: "pu1", _count: { _all: 12 } }]);
    userFindMany
      .mockResolvedValueOnce([{ id: "u1", email: "amine@example.dz", phone: "0550000000", profile: { displayName: "Amine", wilaya: { nomFr: "Alger", nomAr: "الجزائر" } } }])
      .mockResolvedValueOnce([
        { id: "pu1", email: "garage@example.dz", phone: "0661111111" },
        { id: "pu2", email: "loueur@example.dz", phone: null },
        { id: "pu3", email: "actif@example.dz", phone: null },
      ]);
    accountFindMany.mockResolvedValue([
      { id: "a1", nomCommercial: "Garage X", phone: null, badgeVerifie: true, userId: "pu1", wilaya: { nomFr: "Oran", nomAr: "وهران" }, subscription: null },
      { id: "a2", nomCommercial: "Loueur Y", phone: "021000000", badgeVerifie: false, userId: "pu2", wilaya: null, subscription: { tier: "PRO", expiresAt: days(5) } },
      { id: "a3", nomCommercial: "Actif Z", phone: null, badgeVerifie: true, userId: "pu3", wilaya: null, subscription: { tier: "BUSINESS", expiresAt: days(40) } },
    ]);
  });

  it("assemble particuliers (≥ 5 annonces), pros sans abonnement et pros qui expirent, avec téléphones lus sur User", async () => {
    const lists = await buildProspectionLists("fr", NOW);

    expect(listingGroupBy.mock.calls[0][0].having).toEqual({ sellerId: { _count: { gte: PROSPECT_MIN_LISTINGS } } });
    expect(listingGroupBy.mock.calls[0][0].where.seller).toMatchObject({ role: "PARTICULIER", professionalAccount: null });
    expect(lists.particuliers).toEqual([
      { userId: "u1", name: "Amine", email: "amine@example.dz", phone: "0550000000", wilaya: "Alger", listingCount: 7, lastListingAt: days(-2) },
    ]);

    expect(lists.prosWithoutSubscription.map((p) => p.name)).toEqual(["Garage X"]);
    expect(lists.prosWithoutSubscription[0]).toMatchObject({ phone: "0661111111", wilaya: "Oran", listingCount: 12, tier: "STARTER", badgeVerifie: true });

    expect(lists.prosExpiring.map((p) => p.name)).toEqual(["Loueur Y"]);
    expect(lists.prosExpiring[0]).toMatchObject({ phone: "021000000", tier: "PRO", listingCount: 0 });
  });

  it("nomme les wilayas en arabe quand la page est en arabe", async () => {
    const lists = await buildProspectionLists("ar", NOW);
    expect(lists.particuliers[0].wilaya).toBe("الجزائر");
    expect(lists.prosWithoutSubscription[0].wilaya).toBe("وهران");
  });
});
