import { beforeEach, describe, expect, it, vi } from "vitest";

const listingFindMany   = vi.fn();
const listingUpdateMany = vi.fn();
const renewalCreate     = vi.fn();
const sendEmail         = vi.fn();
const getTranslations   = vi.fn();
const isEligibleForAutoRenewal = vi.fn();
const computeExpiryDate        = vi.fn();
const effectiveTier            = vi.fn();
const hasAdvancedProTools      = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: {
      findMany:   (...a: unknown[]) => listingFindMany(...a),
      updateMany: (...a: unknown[]) => listingUpdateMany(...a),
    },
    listingRenewal: { create: (...a: unknown[]) => renewalCreate(...a) },
  },
}));
vi.mock("@/lib/mailer", () => ({
  sendEmail:   (...a: unknown[]) => sendEmail(...a),
  escapeHtml:  (s: string) => s,
}));
vi.mock("next-intl/server", () => ({ getTranslations: () => getTranslations() }));
vi.mock("@/lib/listing-lifecycle", () => ({
  isEligibleForAutoRenewal: (...a: unknown[]) => isEligibleForAutoRenewal(...a),
  computeExpiryDate:        (...a: unknown[]) => computeExpiryDate(...a),
}));
vi.mock("@/lib/pro-subscription", () => ({
  effectiveTier:       (...a: unknown[]) => effectiveTier(...a),
  hasAdvancedProTools: (...a: unknown[]) => hasAdvancedProTools(...a),
}));

import { sweepAutoRenewals } from "@/lib/listing-auto-renew-sweep";

const NOW = new Date("2025-06-01T12:00:00Z");
const NEW_EXPIRY = new Date("2025-07-01T12:00:00Z");

const makeListing = (overrides = {}) => ({
  id: "listing1",
  title: "Renault Clio",
  status: "PUBLIEE",
  autoRenew: true,
  expiresAt: new Date("2025-05-31T12:00:00Z"),
  seller: {
    id: "seller1",
    email: "pro@example.dz",
    locale: "fr",
    professionalAccount: {
      id: "pro1",
      subscription: { tier: "PRO", expiresAt: null },
    },
  },
  ...overrides,
});

const tFn = (key: string, args?: Record<string, unknown>) => {
  if (key === "greeting") return "Bonjour,";
  if (key === "autoRenewedSubject") return "Annonce renouvelée";
  if (key === "autoRenewedBody") return `${args?.title} renouvelée`;
  if (key === "autoRenewedLink") return "Voir l'annonce";
  return key;
};

beforeEach(() => {
  vi.resetAllMocks();
  getTranslations.mockResolvedValue(tFn);
  sendEmail.mockResolvedValue({ previewUrl: undefined });
  renewalCreate.mockResolvedValue({});
  listingUpdateMany.mockResolvedValue({ count: 1 });
  computeExpiryDate.mockReturnValue(NEW_EXPIRY);
  effectiveTier.mockReturnValue("PRO");
  hasAdvancedProTools.mockReturnValue(true);
  isEligibleForAutoRenewal.mockReturnValue(true);
});

describe("sweepAutoRenewals", () => {
  it("skips listings without a pro account", async () => {
    const listing = makeListing({ seller: { ...makeListing().seller, professionalAccount: null } });
    listingFindMany.mockResolvedValue([listing]);
    await sweepAutoRenewals(NOW);
    expect(listingUpdateMany).not.toHaveBeenCalled();
  });

  it("skips listings that fail the eligibility check", async () => {
    isEligibleForAutoRenewal.mockReturnValue(false);
    listingFindMany.mockResolvedValue([makeListing()]);
    await sweepAutoRenewals(NOW);
    expect(listingUpdateMany).not.toHaveBeenCalled();
  });

  it("updates the listing atomically before sending the email", async () => {
    listingFindMany.mockResolvedValue([makeListing()]);
    await sweepAutoRenewals(NOW);
    expect(listingUpdateMany).toHaveBeenCalledBefore(sendEmail as ReturnType<typeof vi.fn>);
    const { where, data } = listingUpdateMany.mock.calls[0][0];
    expect(where.id).toBe("listing1");
    expect(data.expiresAt).toEqual(NEW_EXPIRY);
    expect(data.publishedAt).toEqual(NOW);
    expect(data.expiryReminderSentAt).toBeNull();
  });

  it("skips the email and renewal record if atomic claim fails", async () => {
    listingFindMany.mockResolvedValue([makeListing()]);
    listingUpdateMany.mockResolvedValue({ count: 0 });
    await sweepAutoRenewals(NOW);
    expect(renewalCreate).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("creates a renewal record with the new expiry date", async () => {
    listingFindMany.mockResolvedValue([makeListing()]);
    await sweepAutoRenewals(NOW);
    expect(renewalCreate).toHaveBeenCalledOnce();
    const { data } = renewalCreate.mock.calls[0][0];
    expect(data.listingId).toBe("listing1");
    expect(data.renewedAt).toEqual(NOW);
    expect(data.expiresAt).toEqual(NEW_EXPIRY);
  });

  it("sends a renewal email to the seller", async () => {
    listingFindMany.mockResolvedValue([makeListing()]);
    await sweepAutoRenewals(NOW);
    expect(sendEmail).toHaveBeenCalledOnce();
    const { to } = sendEmail.mock.calls[0][0];
    expect(to).toBe("pro@example.dz");
  });

  it("does nothing when no candidates are found", async () => {
    listingFindMany.mockResolvedValue([]);
    await sweepAutoRenewals(NOW);
    expect(listingUpdateMany).not.toHaveBeenCalled();
  });
});
