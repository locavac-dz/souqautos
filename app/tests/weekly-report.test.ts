// Lot 275 — rapport hebdomadaire : période, évolution, courriel, destinataires, envoi unique par semaine.
import { beforeEach, describe, expect, it, vi } from "vitest";

// Toutes les requêtes de collecte renvoient des valeurs neutres : ce test vérifie l'orchestration, pas la base.
const { weeklyFindUnique, weeklyUpsert, sendEmailBestEffort, counts, count, aggregate } = vi.hoisted(() => {
  const counts = { value: 0 };
  return {
    weeklyFindUnique: vi.fn(),
    weeklyUpsert: vi.fn(),
    sendEmailBestEffort: vi.fn(),
    counts,
    count: vi.fn(async () => counts.value),
    aggregate: vi.fn(async () => ({ _count: { _all: 0 }, _sum: { amountDzd: 0, count: 0 } })),
  };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    weeklyReport: { findUnique: (...a: unknown[]) => weeklyFindUnique(...a), upsert: (...a: unknown[]) => weeklyUpsert(...a) },
    listing: { count, findMany: async () => [], findFirst: async () => null },
    auditLog: { count },
    user: { count },
    professionalAccount: { count },
    paymentOrder: { aggregate },
    proSubscriptionOrder: { aggregate },
    offer: { count },
    conversation: { count },
    message: { count },
    report: { count },
    contactMessage: { count },
    listingViewDay: { aggregate },
    pageViewDay: { aggregate },
    proSubscription: { count },
  },
}));
vi.mock("@/lib/mailer", () => ({ sendEmailBestEffort: (...a: unknown[]) => sendEmailBestEffort(...a), escapeHtml: (s: string) => s }));
vi.mock("@/lib/site", () => ({ SITE_URL: "https://souqauto.example" }));

import {
  buildWeeklyReportEmail,
  formatDelta,
  lastCompleteWeek,
  previousWeek,
  resolveWeeklyReportRecipients,
  sendWeeklyReport,
  sendWeeklyReportIfDue,
  type WeeklyMetrics,
} from "@/lib/weekly-report";

describe("lastCompleteWeek", () => {
  it("va du lundi précédent 00:00 au lundi de la semaine en cours, quel que soit le jour", () => {
    // Jeudi 9 octobre 2026 → semaine du lundi 28 septembre au dimanche 4 octobre (fin exclusive lundi 5).
    const p = lastCompleteWeek(new Date(2026, 9, 9, 4, 0));
    expect(p.start).toEqual(new Date(2026, 8, 28, 0, 0));
    expect(p.end).toEqual(new Date(2026, 9, 5, 0, 0));
    // Lundi 5 octobre 04:00 → même semaine (elle vient de se terminer).
    expect(lastCompleteWeek(new Date(2026, 9, 5, 4, 0))).toEqual(p);
    // Dimanche 4 octobre → la semaine d'avant.
    expect(lastCompleteWeek(new Date(2026, 9, 4, 23, 0)).start).toEqual(new Date(2026, 8, 21, 0, 0));
    expect(previousWeek(p)).toEqual({ start: new Date(2026, 8, 21, 0, 0), end: p.start });
  });
});

describe("formatDelta", () => {
  it("rend une évolution lisible", () => {
    expect(formatDelta(112, 100)).toBe("+12 %");
    expect(formatDelta(95, 100)).toBe("−5 %");
    expect(formatDelta(100, 100)).toBe("=");
    expect(formatDelta(3, 0)).toBe("nouveau");
    expect(formatDelta(0, 0)).toBe("—");
  });
});

const metrics = (over: Partial<WeeklyMetrics> = {}): WeeklyMetrics => ({
  listingsSubmitted: 40, listingsPublished: 30, listingsAutoPublished: 12, listingsRejected: 3, moderationMedianHours: 5.4,
  newUsers: 25, newProAccounts: 2, paymentsConfirmedCount: 4, paymentsConfirmedAmountDzd: 7000, offers: 10, conversations: 18,
  messages: 90, reportsOpened: 2, reportsResolved: 3, contactsReceived: 6, contactsAnswered: 5, listingViews: 4200, pageViews: 9800,
  pendingNow: 4, oldestPendingHours: 7, reportsOpenNow: 1, contactsOpenNow: 2, activePaidSubscriptions: 5, subscriptionsExpiringSoon: 1,
  pendingTransfersCount: 2, pendingTransfersAmountDzd: 4000, ...over,
});

describe("buildWeeklyReportEmail", () => {
  it("titre la période, aligne cette semaine / précédente / évolution, et donne l'état du lundi", () => {
    const period = { start: new Date(2026, 8, 28), end: new Date(2026, 9, 5) };
    const email = buildWeeklyReportEmail({ period, current: metrics(), previous: metrics({ listingsPublished: 20, pageViews: 0 }), siteUrl: "https://souqauto.example" });
    expect(email.subject).toContain("Rapport hebdomadaire — du 28 septembre 2026 au 4 octobre 2026");
    expect(email.html).toContain("<td style=\"padding:4px 10px;border-bottom:1px solid #e2e8f0\">Annonces publiées</td>");
    expect(email.html).toMatch(/Annonces publiées<\/td><td[^>]*>30<\/td><td[^>]*>20<\/td><td[^>]*>\+50 %/);
    expect(email.html).toMatch(/Pages vues \(site public\)<\/td><td[^>]*>9[\s  ]?800<\/td><td[^>]*>0<\/td><td[^>]*>nouveau/);
    expect(email.html).toContain("Montant encaissé");
    expect(email.html).toContain("la plus ancienne : 7 h");
    expect(email.html).toContain("dont 1 expirent sous 15 jours");
    expect(email.html).toContain("https://souqauto.example/fr/admin/rapports");
  });
});

describe("resolveWeeklyReportRecipients", () => {
  it("réunit l'équipe et le PDG sans doublon", () => {
    expect(resolveWeeklyReportRecipients({ STAFF_ALERT_EMAILS: "equipe@souqauto.dz, pdg@souqauto.dz", ADMIN_EMAIL: "pdg@souqauto.dz" })).toEqual([
      "equipe@souqauto.dz",
      "pdg@souqauto.dz",
    ]);
    expect(resolveWeeklyReportRecipients({})).toEqual([]);
  });
});

describe("sendWeeklyReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    counts.value = 0;
    weeklyFindUnique.mockResolvedValue(null);
    weeklyUpsert.mockResolvedValue({});
    sendEmailBestEffort.mockResolvedValue({});
    vi.stubEnv("STAFF_ALERT_EMAILS", "equipe@souqauto.dz");
    vi.stubEnv("ADMIN_EMAIL", "pdg@souqauto.dz");
  });

  it("envoie aux destinataires et conserve les chiffres de la semaine et de la précédente", async () => {
    const now = new Date(2026, 9, 5, 4, 0);
    const result = await sendWeeklyReport(now);
    expect(result).toEqual({ status: "sent", periodStart: new Date(2026, 8, 28).toISOString(), recipients: 2 });
    expect(sendEmailBestEffort).toHaveBeenCalledTimes(2);
    expect(sendEmailBestEffort.mock.calls.map((c) => c[1].to).sort()).toEqual(["equipe@souqauto.dz", "pdg@souqauto.dz"]);
    const upsert = weeklyUpsert.mock.calls[0][0];
    expect(upsert.where).toEqual({ periodStart: new Date(2026, 8, 28) });
    expect(upsert.create.payload.current).toHaveProperty("listingsPublished");
    expect(upsert.create.payload.previous).toHaveProperty("pendingNow");
  });

  it("n'envoie pas deux fois la même semaine, sauf envoi forcé", async () => {
    weeklyFindUnique.mockResolvedValue({ id: "w1" });
    expect(await sendWeeklyReportIfDue(new Date(2026, 9, 6))).toEqual({ status: "already_sent", periodStart: new Date(2026, 8, 28).toISOString() });
    expect(sendEmailBestEffort).not.toHaveBeenCalled();

    expect((await sendWeeklyReport(new Date(2026, 9, 6), { force: true })).status).toBe("sent");
    expect(sendEmailBestEffort).toHaveBeenCalledTimes(2);
  });

  it("sans destinataire : rien n'est envoyé ni enregistré", async () => {
    vi.stubEnv("STAFF_ALERT_EMAILS", "");
    vi.stubEnv("ADMIN_EMAIL", "");
    expect((await sendWeeklyReport(new Date(2026, 9, 6))).status).toBe("no_recipients");
    expect(weeklyUpsert).not.toHaveBeenCalled();
  });

  it("ne lève jamais depuis le balayage", async () => {
    weeklyFindUnique.mockRejectedValue(new Error("db down"));
    expect(await sendWeeklyReportIfDue(new Date(2026, 9, 6))).toEqual({ status: "error" });
  });
});
