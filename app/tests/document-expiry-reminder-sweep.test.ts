import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const updateMany = vi.fn();
const notifyUser = vi.fn();
const getTranslations = vi.fn();
const escapeHtml = vi.fn((v: string) => v);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: {
      findMany: (...a: unknown[]) => findMany(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
  },
}));
vi.mock("@/lib/notify-user", () => ({ notifyUser: (...a: unknown[]) => notifyUser(...a) }));
vi.mock("@/lib/mailer", () => ({ escapeHtml: (v: string) => escapeHtml(v) }));
vi.mock("@/lib/site", () => ({ SITE_URL: "https://souqautos.com" }));
vi.mock("next-intl/server", () => ({
  getTranslations: (...a: unknown[]) => getTranslations(...a),
}));

import { sweepDocumentExpiryReminders, REMINDER_DAYS } from "@/lib/document-expiry-reminder-sweep";

const now = new Date("2026-11-01T08:00:00Z");
const in20Days = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);

function makeListing(overrides: Record<string, unknown> = {}) {
  return {
    id: "listing-1",
    title: "Clio 4",
    assuranceExpiry: in20Days,
    controltechniqueExpiry: null,
    assuranceExpiryReminderSentAt: null,
    ctExpiryReminderSentAt: null,
    seller: { id: "seller-1", email: "seller@example.com", locale: "fr" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  findMany.mockResolvedValue([]);
  updateMany.mockResolvedValue({ count: 1 });
  notifyUser.mockResolvedValue(undefined);
  const t = (key: string, values?: Record<string, unknown>) => `${key}:${JSON.stringify(values ?? {})}`;
  getTranslations.mockResolvedValue(t);
});

describe("sweepDocumentExpiryReminders", () => {
  it("sends a notification when assurance expires within 30 days", async () => {
    findMany.mockResolvedValueOnce([makeListing()]);
    findMany.mockResolvedValueOnce([]); // CT pass returns nothing

    const stats = await sweepDocumentExpiryReminders(now);

    expect(stats.assurance).toBe(1);
    expect(stats.ct).toBe(0);
    expect(notifyUser).toHaveBeenCalledTimes(1);
    expect(notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "seller-1",
        kind: "ASSURANCE_EXPIRING",
        url: "/fr/annonce/listing-1",
      }),
    );
  });

  it("sends a CT notification when controltechniqueExpiry is within 30 days", async () => {
    findMany.mockResolvedValueOnce([]); // assurance pass returns nothing
    findMany.mockResolvedValueOnce([
      makeListing({
        controltechniqueExpiry: in20Days,
        assuranceExpiry: null,
      }),
    ]);

    const stats = await sweepDocumentExpiryReminders(now);

    expect(stats.assurance).toBe(0);
    expect(stats.ct).toBe(1);
    expect(notifyUser).toHaveBeenCalledTimes(1);
    expect(notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "CT_EXPIRING" }),
    );
  });

  it("skips listings already reminded (atomic claim returns count: 0)", async () => {
    findMany.mockResolvedValueOnce([makeListing()]);
    findMany.mockResolvedValueOnce([]);
    updateMany.mockResolvedValue({ count: 0 });

    const stats = await sweepDocumentExpiryReminders(now);

    expect(stats.assurance).toBe(0);
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it("sends both assurance and CT reminders in one sweep", async () => {
    findMany.mockResolvedValueOnce([makeListing()]);
    findMany.mockResolvedValueOnce([
      makeListing({ id: "listing-2", controltechniqueExpiry: in20Days, assuranceExpiry: null }),
    ]);

    const stats = await sweepDocumentExpiryReminders(now);

    expect(stats.assurance).toBe(1);
    expect(stats.ct).toBe(1);
    expect(notifyUser).toHaveBeenCalledTimes(2);
  });

  it("returns zero counts when there are no candidates", async () => {
    const stats = await sweepDocumentExpiryReminders(now);
    expect(stats).toEqual({ assurance: 0, ct: 0 });
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it("includes email, push and in-app channels", async () => {
    findMany.mockResolvedValueOnce([makeListing()]);
    findMany.mockResolvedValueOnce([]);

    await sweepDocumentExpiryReminders(now);

    const call = notifyUser.mock.calls[0][0];
    expect(call.email).toBeDefined();
    expect(call.email.to).toBe("seller@example.com");
    expect(call.push).toBeDefined();
    expect(call.push.lang).toBe("fr");
    expect(call.body).toBeDefined();
  });

  it("uses Arabic locale for AR sellers", async () => {
    findMany.mockResolvedValueOnce([
      makeListing({ seller: { id: "seller-ar", email: "ar@example.com", locale: "ar" } }),
    ]);
    findMany.mockResolvedValueOnce([]);

    await sweepDocumentExpiryReminders(now);

    expect(getTranslations).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "ar" }),
    );
    const call = notifyUser.mock.calls[0][0];
    expect(call.push.lang).toBe("ar");
    expect(call.url).toMatch(/^\/ar\//);
  });
});
