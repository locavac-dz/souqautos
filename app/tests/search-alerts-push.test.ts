import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, type Listing } from "@prisma/client";

const alertFindMany = vi.fn();
const listingFindFirst = vi.fn();
const notificationCreate = vi.fn();
const sendEmail = vi.fn();
const sendPushToUser = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    searchAlert: { findMany: (...a: unknown[]) => alertFindMany(...a) },
    listing: { findFirst: (...a: unknown[]) => listingFindFirst(...a) },
    searchAlertNotification: { create: (...a: unknown[]) => notificationCreate(...a) },
  },
}));
vi.mock("@/lib/mailer", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a), escapeHtml: (s: string) => s }));
vi.mock("@/lib/push-send", () => ({ sendPushToUser: (...a: unknown[]) => sendPushToUser(...a) }));
vi.mock("@/lib/site", () => ({ SITE_URL: "https://souqauto.example" }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: Record<string, string>) => (values ? `${key}|${Object.values(values).join("|")}` : key),
}));

import { notifyMatchingSearchAlerts } from "@/lib/search-alerts";

const listing = { id: "listing1", title: "Renault Clio 4", price: 1850000, sellerId: "seller1" } as Listing;
const alertOf = (overrides: Record<string, unknown> = {}) => ({
  id: "alert1",
  userId: "buyer1",
  label: "Clio",
  filters: "{}",
  user: { email: "buyer@example.dz", locale: "fr" },
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  alertFindMany.mockResolvedValue([alertOf()]);
  listingFindFirst.mockResolvedValue({ id: "listing1" });
  notificationCreate.mockResolvedValue({});
  sendEmail.mockResolvedValue({});
  sendPushToUser.mockResolvedValue({ sent: 1, removed: 0, failed: 0 });
});

describe("alertes de recherche — notification push", () => {
  it("sends the alert to the devices of the alert owner, pointing at the listing, right after the email", async () => {
    await notifyMatchingSearchAlerts(listing);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    const [userId, payload] = sendPushToUser.mock.calls[0];
    expect(userId).toBe("buyer1");
    expect(payload).toMatchObject({ title: "pushSearchAlertTitle", url: "/fr/annonce/listing1", tag: "alert-alert1-listing1", lang: "fr" });
    expect(payload.body).toContain("Renault Clio 4");
  });

  it("uses the Arabic page and language for an Arabic-speaking user", async () => {
    alertFindMany.mockResolvedValue([alertOf({ user: { email: "b@example.dz", locale: "ar" } })]);
    await notifyMatchingSearchAlerts(listing);
    expect(sendPushToUser.mock.calls[0][1]).toMatchObject({ url: "/ar/annonce/listing1", lang: "ar" });
  });

  it("does not notify when the new listing does not match the alert", async () => {
    listingFindFirst.mockResolvedValue(null);
    await notifyMatchingSearchAlerts(listing);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("does not notify twice for the same listing (already notified)", async () => {
    notificationCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" }));
    await notifyMatchingSearchAlerts(listing);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("does not notify the seller about their own listing", async () => {
    await notifyMatchingSearchAlerts(listing);
    expect(alertFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: { not: "seller1" } } }));
  });

  it("still sends the push when the email fails (the two channels are independent)", async () => {
    sendEmail.mockRejectedValue(new Error("SMTP down"));
    await notifyMatchingSearchAlerts(listing);
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
  });

  it("skips a corrupted alert without sending anything or crashing the moderation flow", async () => {
    alertFindMany.mockResolvedValue([alertOf({ filters: "pas du json" })]);
    await expect(notifyMatchingSearchAlerts(listing)).resolves.toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });
});
