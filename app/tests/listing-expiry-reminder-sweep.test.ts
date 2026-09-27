import { beforeEach, describe, expect, it, vi } from "vitest";

const listingFindMany   = vi.fn();
const listingUpdateMany = vi.fn();
const sendEmail         = vi.fn();
const getTranslations   = vi.fn();
const shouldSendExpiryReminder = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: {
      findMany:   (...a: unknown[]) => listingFindMany(...a),
      updateMany: (...a: unknown[]) => listingUpdateMany(...a),
    },
  },
}));
vi.mock("@/lib/mailer", () => ({
  sendEmail:   (...a: unknown[]) => sendEmail(...a),
  escapeHtml:  (s: string) => s,
}));
vi.mock("next-intl/server", () => ({ getTranslations: () => getTranslations() }));
vi.mock("@/lib/listing-lifecycle", () => ({
  shouldSendExpiryReminder: (...a: unknown[]) => shouldSendExpiryReminder(...a),
}));

import { sweepExpiringListingsForReminders } from "@/lib/listing-expiry-reminder-sweep";

const NOW = new Date("2025-06-15T10:00:00Z");
const EXPIRES_SOON = new Date("2025-06-17T10:00:00Z");

const makeListing = (overrides = {}) => ({
  id: "listing1",
  title: "Peugeot 208",
  expiresAt: EXPIRES_SOON,
  expiryReminderSentAt: null,
  status: "PUBLIEE",
  seller: {
    id: "seller1",
    email: "seller@example.dz",
    locale: "fr",
  },
  ...overrides,
});

const tFn = (key: string, args?: Record<string, string>) => {
  if (key === "greeting") return "Bonjour,";
  if (key === "expiryReminderSubject") return "Votre annonce expire bientôt";
  if (key === "expiryReminderBody") return `Annonce : ${args?.title}`;
  if (key === "expiryReminderLink") return "Voir l'annonce";
  return key;
};

beforeEach(() => {
  vi.resetAllMocks();
  getTranslations.mockResolvedValue(tFn);
  sendEmail.mockResolvedValue({ previewUrl: undefined });
  listingUpdateMany.mockResolvedValue({ count: 1 });
  shouldSendExpiryReminder.mockReturnValue(true);
});

describe("sweepExpiringListingsForReminders", () => {
  it("skips listings that do not meet the reminder condition", async () => {
    shouldSendExpiryReminder.mockReturnValue(false);
    listingFindMany.mockResolvedValue([makeListing()]);
    await sweepExpiringListingsForReminders(NOW);
    expect(listingUpdateMany).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("marks the listing atomically before sending the email", async () => {
    listingFindMany.mockResolvedValue([makeListing()]);
    await sweepExpiringListingsForReminders(NOW);
    expect(listingUpdateMany).toHaveBeenCalledBefore(sendEmail as ReturnType<typeof vi.fn>);
    const { where, data } = listingUpdateMany.mock.calls[0][0];
    expect(where.id).toBe("listing1");
    expect(where.expiryReminderSentAt).toBeNull();
    expect(data.expiryReminderSentAt).toEqual(NOW);
  });

  it("skips the email if the atomic claim fails (count === 0)", async () => {
    listingFindMany.mockResolvedValue([makeListing()]);
    listingUpdateMany.mockResolvedValue({ count: 0 });
    await sweepExpiringListingsForReminders(NOW);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends the email to the seller's address", async () => {
    const listing = makeListing();
    listingFindMany.mockResolvedValue([listing]);
    await sweepExpiringListingsForReminders(NOW);
    expect(sendEmail).toHaveBeenCalledOnce();
    const { to } = sendEmail.mock.calls[0][0];
    expect(to).toBe(listing.seller.email);
  });

  it("does nothing when there are no candidates", async () => {
    listingFindMany.mockResolvedValue([]);
    await sweepExpiringListingsForReminders(NOW);
    expect(listingUpdateMany).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("queries only PUBLIEE listings whose reminder has not been sent", async () => {
    listingFindMany.mockResolvedValue([]);
    await sweepExpiringListingsForReminders(NOW);
    const { where } = listingFindMany.mock.calls[0][0];
    expect(where.status).toBe("PUBLIEE");
    expect(where.expiryReminderSentAt).toBeNull();
  });
});
