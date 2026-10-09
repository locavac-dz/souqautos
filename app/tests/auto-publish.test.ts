// Lot 272 — modération à deux vitesses : décision pure, puis orchestration contre une base simulée.
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getModerationSettings,
  listingFindUnique,
  listingCount,
  listingUpdateMany,
  reportCount,
  notifySellerOfModeration,
  broadcastPublication,
  writeAuditLog,
} = vi.hoisted(() => ({
  getModerationSettings: vi.fn(),
  listingFindUnique: vi.fn(),
  listingCount: vi.fn(),
  listingUpdateMany: vi.fn(),
  reportCount: vi.fn(),
  notifySellerOfModeration: vi.fn(),
  broadcastPublication: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/moderation-settings", () => ({ getModerationSettings: () => getModerationSettings() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: {
      findUnique: (...a: unknown[]) => listingFindUnique(...a),
      count: (...a: unknown[]) => listingCount(...a),
      updateMany: (...a: unknown[]) => listingUpdateMany(...a),
    },
    report: { count: (...a: unknown[]) => reportCount(...a) },
  },
}));
vi.mock("@/lib/listing-publication", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/listing-publication")>();
  return {
    ...actual,
    notifySellerOfModeration: (...a: unknown[]) => notifySellerOfModeration(...a),
    broadcastPublication: (...a: unknown[]) => broadcastPublication(...a),
  };
});
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));

import { decideAutoPublish, tryAutoPublish, type AutoPublishInput } from "@/lib/auto-publish";

const ENABLED = { autoPublishEnabled: true, autoPublishMinApprovedListings: 1 };
const CLEAN: AutoPublishInput = {
  settings: ENABLED,
  listing: {
    status: "EN_ATTENTE",
    fraudCheckedAt: new Date("2026-10-09T10:00:00Z"),
    fraudScore: 0,
    aiCheckedAt: new Date("2026-10-09T10:00:01Z"),
    aiSuspicion: null,
    photoQualityFlags: [],
  },
  aiConfigured: true,
  seller: { humanApprovedCount: 2, incidentCount: 0 },
};

describe("decideAutoPublish", () => {
  it("publie une annonce sans aucun signal d'un vendeur déjà approuvé", () => {
    expect(decideAutoPublish(CLEAN)).toEqual({ publish: true });
  });

  it("ne fait rien quand la règle est désactivée (motif unique, sans examiner le reste)", () => {
    const decision = decideAutoPublish({ ...CLEAN, settings: { ...ENABLED, autoPublishEnabled: false }, seller: { humanApprovedCount: 0, incidentCount: 3 } });
    expect(decision).toEqual({ publish: false, blockers: ["disabled"] });
  });

  it("garde la première annonce d'un compte pour un humain (historique insuffisant)", () => {
    expect(decideAutoPublish({ ...CLEAN, seller: { humanApprovedCount: 0, incidentCount: 0 } })).toEqual({
      publish: false,
      blockers: ["seller_history"],
    });
  });

  it("respecte le minimum réglable d'annonces approuvées", () => {
    const input = { ...CLEAN, settings: { ...ENABLED, autoPublishMinApprovedListings: 3 } };
    expect(decideAutoPublish(input).publish).toBe(false);
    expect(decideAutoPublish({ ...input, seller: { humanApprovedCount: 3, incidentCount: 0 } }).publish).toBe(true);
  });

  it("bloque sur le moindre signal anti-fraude, soupçon IA ou défaut de photo", () => {
    expect(decideAutoPublish({ ...CLEAN, listing: { ...CLEAN.listing, fraudScore: 25 } })).toEqual({ publish: false, blockers: ["fraud_signals"] });
    expect(decideAutoPublish({ ...CLEAN, listing: { ...CLEAN.listing, aiSuspicion: "Urgence suspecte" } })).toEqual({ publish: false, blockers: ["ai_suspicion"] });
    expect(decideAutoPublish({ ...CLEAN, listing: { ...CLEAN.listing, photoQualityFlags: ["too_dark"] } })).toEqual({ publish: false, blockers: ["photo_quality"] });
  });

  it("attend que les contrôles aient tourné (score non calculé, IA configurée mais non passée)", () => {
    expect(decideAutoPublish({ ...CLEAN, listing: { ...CLEAN.listing, fraudCheckedAt: null } })).toEqual({ publish: false, blockers: ["fraud_not_checked"] });
    expect(decideAutoPublish({ ...CLEAN, listing: { ...CLEAN.listing, aiCheckedAt: null } })).toEqual({ publish: false, blockers: ["ai_not_checked"] });
  });

  it("n'exige pas l'analyse IA quand aucune clé n'est configurée", () => {
    expect(decideAutoPublish({ ...CLEAN, aiConfigured: false, listing: { ...CLEAN.listing, aiCheckedAt: null } })).toEqual({ publish: true });
  });

  it("bloque un vendeur avec un incident (refus, suspension ou signalement confirmé)", () => {
    expect(decideAutoPublish({ ...CLEAN, seller: { humanApprovedCount: 5, incidentCount: 1 } })).toEqual({ publish: false, blockers: ["seller_incidents"] });
  });

  it("ne publie que depuis EN_ATTENTE et liste TOUS les motifs", () => {
    const decision = decideAutoPublish({
      ...CLEAN,
      listing: { ...CLEAN.listing, status: "SUSPENDUE", fraudScore: 40, photoQualityFlags: ["low_resolution"] },
      seller: { humanApprovedCount: 0, incidentCount: 2 },
    });
    expect(decision).toEqual({
      publish: false,
      blockers: ["not_pending", "fraud_signals", "photo_quality", "seller_history", "seller_incidents"],
    });
  });
});

const NOW = new Date("2026-10-09T12:00:00Z");
const LISTING = {
  id: "l1",
  sellerId: "s1",
  title: "Renault Clio 4",
  status: "EN_ATTENTE",
  publishedAt: null,
  formula: "STANDARD",
  fraudCheckedAt: new Date("2026-10-09T11:59:00Z"),
  fraudScore: 0,
  aiCheckedAt: new Date("2026-10-09T11:59:30Z"),
  aiSuspicion: null,
  photos: [{ qualityFlags: "[]" }, { qualityFlags: "[]" }],
};

describe("tryAutoPublish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getModerationSettings.mockResolvedValue({ ...ENABLED, autoSuspendListingThreshold: 3, autoSuspendUserThreshold: 3 });
    listingFindUnique.mockResolvedValue(LISTING);
    // 1er count = annonces approuvées par un humain ; 2e = refusées/suspendues.
    listingCount.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    reportCount.mockResolvedValue(0);
    listingUpdateMany.mockResolvedValue({ count: 1 });
    notifySellerOfModeration.mockResolvedValue(undefined);
    broadcastPublication.mockResolvedValue(undefined);
    writeAuditLog.mockResolvedValue(undefined);
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  });

  it("publie, fixe l'expiration et la trace automatique, notifie, diffuse et journalise sans acteur humain", async () => {
    const result = await tryAutoPublish("l1", NOW);
    expect(result).toEqual({ publish: true });

    const update = listingUpdateMany.mock.calls[0][0];
    expect(update.where).toEqual({ id: "l1", status: "EN_ATTENTE" });
    expect(update.data).toMatchObject({ status: "PUBLIEE", publishedAt: NOW, autoPublishedAt: NOW, moderationNote: null });
    expect(update.data.expiresAt).toBeInstanceOf(Date);

    expect(notifySellerOfModeration).toHaveBeenCalledWith(expect.objectContaining({ outcome: "approve" }));
    expect(broadcastPublication).toHaveBeenCalledOnce();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: null, action: "listing.auto_publish", targetId: "l1" })
    );
  });

  it("ne compte comme historique que les annonces publiées par un humain, hors celle-ci", async () => {
    await tryAutoPublish("l1", NOW);
    expect(listingCount.mock.calls[0][0].where).toMatchObject({
      sellerId: "s1",
      id: { not: "l1" },
      publishedAt: { not: null },
      autoPublishedAt: null,
    });
  });

  it("ne charge rien quand la règle est désactivée", async () => {
    getModerationSettings.mockResolvedValue({ ...ENABLED, autoPublishEnabled: false });
    expect(await tryAutoPublish("l1", NOW)).toEqual({ publish: false, blockers: ["disabled"] });
    expect(listingFindUnique).not.toHaveBeenCalled();
  });

  it("laisse l'annonce dans la file (aucune écriture) quand un motif bloque", async () => {
    listingFindUnique.mockResolvedValue({ ...LISTING, photos: [{ qualityFlags: '["too_dark"]' }] });
    const result = await tryAutoPublish("l1", NOW);
    expect(result).toEqual({ publish: false, blockers: ["photo_quality"] });
    expect(listingUpdateMany).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it("cède la place à un modérateur qui a tranché entre-temps (updateMany à 0)", async () => {
    listingUpdateMany.mockResolvedValue({ count: 0 });
    expect(await tryAutoPublish("l1", NOW)).toEqual({ publish: false, blockers: ["race_lost"] });
    expect(notifySellerOfModeration).not.toHaveBeenCalled();
  });

  it("additionne les incidents : annonces refusées/suspendues et signalements confirmés", async () => {
    listingCount.mockReset().mockResolvedValueOnce(4).mockResolvedValueOnce(0);
    reportCount.mockResolvedValue(1);
    expect(await tryAutoPublish("l1", NOW)).toEqual({ publish: false, blockers: ["seller_incidents"] });
    expect(reportCount.mock.calls[0][0].where).toMatchObject({ status: "TRAITE" });
  });

  it("ne lève jamais : une erreur de base laisse l'annonce en modération", async () => {
    listingFindUnique.mockRejectedValue(new Error("db down"));
    expect(await tryAutoPublish("l1", NOW)).toEqual({ publish: false, blockers: ["error"] });
  });
});
