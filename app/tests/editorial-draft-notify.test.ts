import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/mailer", () => ({
  sendEmailBestEffort: vi.fn().mockResolvedValue(null),
  escapeHtml: vi.fn((s: string) => s),
}));

vi.mock("@/lib/site", () => ({
  SITE_URL: "https://souqautos.com",
}));

import { sendEmailBestEffort } from "@/lib/mailer";
import { buildEditorialNotifyEmail, resolveEditorialNotifyRecipients, notifyEditorialDrafts } from "@/lib/editorial-draft-notify";
import type { EditorialDraftResult } from "@/lib/editorial-draft-sweep";

const mockedSend = vi.mocked(sendEmailBestEffort);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveEditorialNotifyRecipients", () => {
  it("returns empty when no env vars are set", () => {
    expect(resolveEditorialNotifyRecipients({})).toEqual([]);
  });

  it("returns STAFF_ALERT_EMAILS", () => {
    expect(resolveEditorialNotifyRecipients({ STAFF_ALERT_EMAILS: "a@b.com,c@d.com" })).toEqual(["a@b.com", "c@d.com"]);
  });

  it("returns ADMIN_EMAIL when no staff", () => {
    expect(resolveEditorialNotifyRecipients({ ADMIN_EMAIL: "admin@test.com" })).toEqual(["admin@test.com"]);
  });

  it("combines both without duplicates", () => {
    const result = resolveEditorialNotifyRecipients({
      STAFF_ALERT_EMAILS: "team@test.com,admin@test.com",
      ADMIN_EMAIL: "admin@test.com",
    });
    expect(result).toEqual(["team@test.com", "admin@test.com"]);
  });
});

describe("buildEditorialNotifyEmail", () => {
  it("returns null when no drafts were created", () => {
    const result: EditorialDraftResult = { articleDraft: null, pressReviewDraft: null, guideDraft: null };
    expect(buildEditorialNotifyEmail(result)).toBeNull();
  });

  it("builds email for a single article draft", () => {
    const result: EditorialDraftResult = { articleDraft: "ai-entretien-saison", pressReviewDraft: null, guideDraft: null };
    const email = buildEditorialNotifyEmail(result)!;
    expect(email.subject).toContain("1 brouillon IA");
    expect(email.subject).not.toContain("brouillons");
    expect(email.html).toContain("ai-entretien-saison");
    expect(email.html).toContain("/admin/mag");
  });

  it("builds email for multiple drafts with plural", () => {
    const result: EditorialDraftResult = { articleDraft: "ai-entretien", pressReviewDraft: "ai-revue-prix", guideDraft: "ai-guide-sandero" };
    const email = buildEditorialNotifyEmail(result)!;
    expect(email.subject).toContain("3 brouillons IA");
    expect(email.html).toContain("/admin/mag");
    expect(email.html).toContain("/admin/guides");
  });

  it("includes guide link pointing to /admin/guides", () => {
    const result: EditorialDraftResult = { articleDraft: null, pressReviewDraft: null, guideDraft: "ai-guide-dacia-sandero" };
    const email = buildEditorialNotifyEmail(result)!;
    expect(email.html).toContain("/admin/guides");
    expect(email.html).toContain("ai-guide-dacia-sandero");
  });

  it("mentions drafts are not published", () => {
    const result: EditorialDraftResult = { articleDraft: "ai-test", pressReviewDraft: null, guideDraft: null };
    const email = buildEditorialNotifyEmail(result)!;
    expect(email.html).toContain("pas publiés");
  });
});

describe("notifyEditorialDrafts", () => {
  it("returns 0 and sends nothing when no drafts", async () => {
    vi.stubEnv("STAFF_ALERT_EMAILS", "team@test.com");
    const count = await notifyEditorialDrafts({ articleDraft: null, pressReviewDraft: null, guideDraft: null });
    expect(count).toBe(0);
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("returns 0 when drafts exist but no recipients", async () => {
    vi.stubEnv("STAFF_ALERT_EMAILS", "");
    vi.stubEnv("ADMIN_EMAIL", "");
    const count = await notifyEditorialDrafts({ articleDraft: "ai-test", pressReviewDraft: null, guideDraft: null });
    expect(count).toBe(0);
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("sends to all recipients and returns the count", async () => {
    vi.stubEnv("STAFF_ALERT_EMAILS", "a@b.com,c@d.com");
    vi.stubEnv("ADMIN_EMAIL", "");
    const count = await notifyEditorialDrafts({ articleDraft: "ai-test", pressReviewDraft: null, guideDraft: null });
    expect(count).toBe(2);
    expect(mockedSend).toHaveBeenCalledTimes(2);
    expect(mockedSend).toHaveBeenCalledWith("editorial-draft-notify", expect.objectContaining({ to: "a@b.com" }));
    expect(mockedSend).toHaveBeenCalledWith("editorial-draft-notify", expect.objectContaining({ to: "c@d.com" }));
  });
});
