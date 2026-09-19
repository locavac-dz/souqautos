import { beforeEach, describe, expect, it, vi } from "vitest";

const counts = { listing: vi.fn(), ownerReview: vi.fn(), identity: vi.fn(), report: vi.fn() };
const checkRateLimit = vi.fn();
const sendEmail = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: { count: (...a: unknown[]) => counts.listing(...a) },
    ownerReview: { count: (...a: unknown[]) => counts.ownerReview(...a) },
    identityVerificationRequest: { count: (...a: unknown[]) => counts.identity(...a) },
    report: { count: (...a: unknown[]) => counts.report(...a) },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/mailer", () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
  escapeHtml: (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
}));

import {
  MAX_STAFF_RECIPIENTS,
  STAFF_ALERT_WINDOW_MS,
  buildStaffAlertEmail,
  notifyStaffOfPending,
  parseStaffEmails,
  totalPending,
} from "@/lib/staff-alerts";

describe("parseStaffEmails", () => {
  it("returns nothing when the variable is not set", () => {
    expect(parseStaffEmails(undefined)).toEqual([]);
    expect(parseStaffEmails("")).toEqual([]);
  });

  it("splits on commas and semicolons, trims, lowercases and removes duplicates", () => {
    expect(parseStaffEmails(" Equipe@Souqauto.example ; moderation@souqauto.example, equipe@souqauto.example ")).toEqual([
      "equipe@souqauto.example",
      "moderation@souqauto.example",
    ]);
  });

  it("ignores entries that are not email addresses", () => {
    expect(parseStaffEmails("pas-une-adresse, a@b, ok@souqauto.example, @x.dz")).toEqual(["ok@souqauto.example"]);
  });

  it("caps the number of recipients", () => {
    const many = Array.from({ length: 25 }, (_, i) => `p${i}@souqauto.example`).join(",");
    expect(parseStaffEmails(many)).toHaveLength(MAX_STAFF_RECIPIENTS);
  });
});

describe("buildStaffAlertEmail", () => {
  const queue = { listings: 3, ownerReviews: 0, identityRequests: 1, reports: 2 };

  it("names the triggering event and the size of the whole queue in the subject", () => {
    expect(totalPending(queue)).toBe(6);
    const { subject } = buildStaffAlertEmail({ kind: "report", counts: queue, siteUrl: "https://souqauto.example" });
    expect(subject).toBe("[Souq Auto] Modération : nouveau signalement — 6 éléments en attente");
  });

  it("agrees the gender of the triggering item in the subject (« nouvel avis », « nouvelle annonce »…)", () => {
    const subjectFor = (kind: "listing" | "ownerReview" | "identity" | "report") =>
      buildStaffAlertEmail({ kind, counts: queue, siteUrl: "https://s.example" }).subject;
    expect(subjectFor("listing")).toContain("nouvelle annonce");
    expect(subjectFor("ownerReview")).toContain("nouvel avis de propriétaire");
    expect(subjectFor("identity")).toContain("nouvelle demande de vérification d'identité");
    expect(subjectFor("report")).toContain("nouveau signalement");
    expect(buildStaffAlertEmail({ kind: "ownerReview", counts: queue, siteUrl: "https://s.example" }).html).toContain("À traiter : nouvel avis de propriétaire.");
  });

  it("lists the queue with a link per item, the triggering type first, and hides empty lines of other types", () => {
    const { html } = buildStaffAlertEmail({ kind: "report", counts: queue, siteUrl: "https://souqauto.example/" });
    expect(html).toContain('href="https://souqauto.example/fr/admin/signalements"');
    expect(html).toContain('href="https://souqauto.example/fr/admin/annonces"');
    expect(html).toContain('href="https://souqauto.example/fr/admin/identite"');
    expect(html).not.toContain("avis-proprietaires"); // 0 en attente et ce n'est pas le déclencheur
    expect(html.indexOf("Signalements ouverts")).toBeLessThan(html.indexOf("Annonces à valider"));
  });

  it("still shows the triggering type when its count is 0 (already handled by the time the mail is built)", () => {
    const { html } = buildStaffAlertEmail({ kind: "ownerReview", counts: queue, siteUrl: "https://souqauto.example" });
    expect(html).toContain("avis-proprietaires");
  });

  it("uses the singular for a single pending item", () => {
    const { subject } = buildStaffAlertEmail({ kind: "listing", counts: { listings: 1, ownerReviews: 0, identityRequests: 0, reports: 0 }, siteUrl: "https://s.example" });
    expect(subject).toContain("1 élément en attente");
    expect(subject).not.toContain("éléments");
  });
});

describe("notifyStaffOfPending", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    delete process.env.STAFF_ALERT_EMAILS;
    checkRateLimit.mockResolvedValue(true);
    sendEmail.mockResolvedValue({});
    counts.listing.mockResolvedValue(2);
    counts.ownerReview.mockResolvedValue(0);
    counts.identity.mockResolvedValue(0);
    counts.report.mockResolvedValue(1);
  });

  it("does nothing, and does not even touch the database, when no recipient is configured", async () => {
    await notifyStaffOfPending("listing");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(counts.listing).not.toHaveBeenCalled();
  });

  it("sends one email per recipient, with the queue counts", async () => {
    process.env.STAFF_ALERT_EMAILS = "a@souqauto.example, b@souqauto.example";
    await notifyStaffOfPending("listing");
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls.map((c) => (c[0] as { to: string }).to).sort()).toEqual(["a@souqauto.example", "b@souqauto.example"]);
    expect((sendEmail.mock.calls[0][0] as { subject: string }).subject).toContain("3 éléments en attente");
  });

  it("sends at most one alert per kind per window", async () => {
    process.env.STAFF_ALERT_EMAILS = "a@souqauto.example";
    checkRateLimit.mockResolvedValue(false);
    await notifyStaffOfPending("report");
    expect(checkRateLimit).toHaveBeenCalledWith("staff-alert:report", { limit: 1, windowMs: STAFF_ALERT_WINDOW_MS });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("never throws: a failing mail server, database or limiter must not affect the request that triggered it", async () => {
    process.env.STAFF_ALERT_EMAILS = "a@souqauto.example";
    sendEmail.mockRejectedValue(new Error("SMTP down"));
    await expect(notifyStaffOfPending("listing")).resolves.toBeUndefined();

    counts.listing.mockRejectedValue(new Error("db down"));
    await expect(notifyStaffOfPending("listing")).resolves.toBeUndefined();

    checkRateLimit.mockRejectedValue(new Error("redis down"));
    await expect(notifyStaffOfPending("listing")).resolves.toBeUndefined();
  });
});
