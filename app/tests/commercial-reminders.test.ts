// Lot 274 — relances commerciales : règles pures, puis balayages contre une base simulée.
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  paymentFindMany, paymentUpdateMany, proOrderFindMany, proOrderUpdateMany, subFindMany, subUpdateMany,
  sendEmailBestEffort, notifyUser, getPaymentSettings,
} = vi.hoisted(() => ({
  paymentFindMany: vi.fn(), paymentUpdateMany: vi.fn(), proOrderFindMany: vi.fn(), proOrderUpdateMany: vi.fn(),
  subFindMany: vi.fn(), subUpdateMany: vi.fn(), sendEmailBestEffort: vi.fn(), notifyUser: vi.fn(), getPaymentSettings: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    paymentOrder: { findMany: (...a: unknown[]) => paymentFindMany(...a), updateMany: (...a: unknown[]) => paymentUpdateMany(...a) },
    proSubscriptionOrder: { findMany: (...a: unknown[]) => proOrderFindMany(...a), updateMany: (...a: unknown[]) => proOrderUpdateMany(...a) },
    proSubscription: { findMany: (...a: unknown[]) => subFindMany(...a), updateMany: (...a: unknown[]) => subUpdateMany(...a) },
  },
}));
vi.mock("@/lib/mailer", () => ({ sendEmailBestEffort: (...a: unknown[]) => sendEmailBestEffort(...a), escapeHtml: (s: string) => s }));
vi.mock("@/lib/notify-user", () => ({ notifyUser: (...a: unknown[]) => notifyUser(...a) }));
vi.mock("@/lib/payment-settings", () => ({ getPaymentSettings: () => getPaymentSettings() }));
vi.mock("@/lib/site", () => ({ SITE_URL: "https://souqauto.example" }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) => (values ? `${key}|${Object.values(values).join("|")}` : key),
}));

import {
  subscriptionReminderDue,
  sweepPendingTransferReminders,
  sweepSubscriptionExpiryReminders,
  transferReminderDue,
} from "@/lib/commercial-reminders";

const NOW = new Date("2026-10-09T04:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

describe("transferReminderDue", () => {
  it("relance une commande en attente depuis 2 jours ou plus, une seule fois", () => {
    expect(transferReminderDue({ createdAt: days(-2), reminderSentAt: null, now: NOW })).toBe(true);
    expect(transferReminderDue({ createdAt: days(-10), reminderSentAt: null, now: NOW })).toBe(true);
    expect(transferReminderDue({ createdAt: days(-1.5), reminderSentAt: null, now: NOW })).toBe(false);
    expect(transferReminderDue({ createdAt: days(-10), reminderSentAt: days(-5), now: NOW })).toBe(false);
  });
});

describe("subscriptionReminderDue", () => {
  it("15 jours avant, puis 3 jours avant, jamais deux fois", () => {
    expect(subscriptionReminderDue({ expiresAt: days(20), reminder15SentAt: null, reminder3SentAt: null, now: NOW })).toBeNull();
    expect(subscriptionReminderDue({ expiresAt: days(15), reminder15SentAt: null, reminder3SentAt: null, now: NOW })).toBe(15);
    expect(subscriptionReminderDue({ expiresAt: days(10), reminder15SentAt: days(-1), reminder3SentAt: null, now: NOW })).toBeNull();
    expect(subscriptionReminderDue({ expiresAt: days(3), reminder15SentAt: days(-12), reminder3SentAt: null, now: NOW })).toBe(3);
    expect(subscriptionReminderDue({ expiresAt: days(2), reminder15SentAt: days(-12), reminder3SentAt: days(-1), now: NOW })).toBeNull();
  });

  it("n'envoie que le rappel à 3 jours si celui à 15 a été manqué, et rien après expiration ou sans date", () => {
    expect(subscriptionReminderDue({ expiresAt: days(2), reminder15SentAt: null, reminder3SentAt: null, now: NOW })).toBe(3);
    expect(subscriptionReminderDue({ expiresAt: days(-1), reminder15SentAt: null, reminder3SentAt: null, now: NOW })).toBeNull();
    expect(subscriptionReminderDue({ expiresAt: null, reminder15SentAt: null, reminder3SentAt: null, now: NOW })).toBeNull();
  });
});

describe("sweepPendingTransferReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paymentFindMany.mockResolvedValue([]);
    proOrderFindMany.mockResolvedValue([]);
    paymentUpdateMany.mockResolvedValue({ count: 1 });
    proOrderUpdateMany.mockResolvedValue({ count: 1 });
    sendEmailBestEffort.mockResolvedValue({});
    getPaymentSettings.mockResolvedValue({ bankName: "BNA", bankRib: "00123", bankAccountHolder: "INGENICA" });
  });

  it("relance une formule d'annonce attendue depuis 2 jours : marquage puis courriel avec RIB et référence", async () => {
    paymentFindMany.mockResolvedValue([
      { id: "o1", formula: "PREMIUM", amountDzd: 1000, reference: "VIR-1", createdAt: days(-3), reminderSentAt: null, user: { email: "k@example.dz", locale: "fr" }, listing: { title: "Clio" } },
      { id: "o2", formula: "PREMIUM", amountDzd: 1000, reference: "VIR-2", createdAt: days(-1), reminderSentAt: null, user: { email: "y@example.dz", locale: "ar" }, listing: { title: "208" } },
    ]);
    const stats = await sweepPendingTransferReminders(NOW);
    expect(stats).toEqual({ listingOrders: 1, subscriptionOrders: 0 });
    expect(paymentFindMany.mock.calls[0][0].where).toEqual({ provider: "VIREMENT", status: "EN_ATTENTE", reminderSentAt: null });
    expect(paymentUpdateMany).toHaveBeenCalledWith({ where: { id: "o1", reminderSentAt: null }, data: { reminderSentAt: NOW } });
    const [tag, mail] = sendEmailBestEffort.mock.calls[0];
    expect(tag).toContain("VIR-1");
    expect(mail.to).toBe("k@example.dz");
    expect(mail.subject).toBe("transferReminderSubject");
    expect(mail.html).toContain("transferReminderListingBody|Premium|Clio|VIR-1|");
    expect(mail.html).toContain("transferReminderBank|BNA|00123|INGENICA|VIR-1");
    expect(mail.html).toContain("/fr/compte/mes-annonces");
  });

  it("n'envoie rien si un autre passage a déjà marqué la commande (course)", async () => {
    paymentFindMany.mockResolvedValue([{ id: "o1", formula: "PREMIUM", amountDzd: 1000, reference: "VIR-1", createdAt: days(-3), reminderSentAt: null, user: { email: "k@example.dz", locale: "fr" }, listing: { title: "Clio" } }]);
    paymentUpdateMany.mockResolvedValue({ count: 0 });
    expect(await sweepPendingTransferReminders(NOW)).toEqual({ listingOrders: 0, subscriptionOrders: 0 });
    expect(sendEmailBestEffort).not.toHaveBeenCalled();
  });

  it("relance un palier pro, sans ligne bancaire quand les coordonnées ne sont pas configurées", async () => {
    getPaymentSettings.mockResolvedValue({ bankName: null, bankRib: null, bankAccountHolder: null });
    proOrderFindMany.mockResolvedValue([{ id: "p1", tier: "BUSINESS", amountDzd: 3000, reference: "VIR-P", createdAt: days(-2), reminderSentAt: null, user: { email: "pro@example.dz", locale: "fr" }, professionalAccount: { nomCommercial: "Garage X" } }]);
    const stats = await sweepPendingTransferReminders(NOW);
    expect(stats.subscriptionOrders).toBe(1);
    const mail = sendEmailBestEffort.mock.calls[0][1];
    expect(mail.html).toContain("transferReminderSubscriptionBody|Business|Garage X|VIR-P|");
    expect(mail.html).not.toContain("transferReminderBank");
    expect(mail.html).toContain("/fr/pro/tableau-de-bord");
  });
});

describe("sweepSubscriptionExpiryReminders", () => {
  const sub = (over: Record<string, unknown>) => ({
    id: "s1", tier: "PRO", expiresAt: days(14), reminder15SentAt: null, reminder3SentAt: null,
    professionalAccount: { nomCommercial: "Garage X", user: { id: "u1", email: "pro@example.dz", locale: "fr" } },
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    subFindMany.mockResolvedValue([]);
    subUpdateMany.mockResolvedValue({ count: 1 });
    notifyUser.mockResolvedValue(undefined);
  });

  it("rappel à 15 jours : marquage puis courriel + notification in-app vers le tableau de bord pro", async () => {
    subFindMany.mockResolvedValue([sub({})]);
    expect(await sweepSubscriptionExpiryReminders(NOW)).toEqual({ first: 1, last: 0 });
    expect(subUpdateMany).toHaveBeenCalledWith({ where: { id: "s1", reminder15SentAt: null }, data: { reminder15SentAt: NOW } });
    const call = notifyUser.mock.calls[0][0];
    expect(call).toMatchObject({ userId: "u1", kind: "SUBSCRIPTION_EXPIRING", url: "/fr/pro/tableau-de-bord" });
    expect(call.email.to).toBe("pro@example.dz");
    expect(call.email.subject).toContain("subscriptionExpiringSubject|Pro|Garage X|15|");
    expect(call.body).toContain("subscriptionExpiringBodyShort");
  });

  it("rappel à 3 jours : marque aussi le rappel à 15 jours s'il avait été manqué", async () => {
    subFindMany.mockResolvedValue([sub({ expiresAt: days(2) })]);
    expect(await sweepSubscriptionExpiryReminders(NOW)).toEqual({ first: 0, last: 1 });
    expect(subUpdateMany).toHaveBeenCalledWith({ where: { id: "s1", reminder3SentAt: null }, data: { reminder3SentAt: NOW, reminder15SentAt: NOW } });
  });

  it("ne rappelle pas un abonnement déjà rappelé ni un Starter, et ne lit que la fenêtre de 15 jours", async () => {
    subFindMany.mockResolvedValue([sub({ reminder15SentAt: days(-1), expiresAt: days(10) })]);
    expect(await sweepSubscriptionExpiryReminders(NOW)).toEqual({ first: 0, last: 0 });
    expect(notifyUser).not.toHaveBeenCalled();
    const where = subFindMany.mock.calls[0][0].where;
    expect(where.tier).toEqual({ not: "STARTER" });
    expect(where.expiresAt).toEqual({ gt: NOW, lte: days(15) });
  });
});
