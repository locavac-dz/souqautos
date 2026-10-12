import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmailBestEffort = vi.fn();
vi.mock("@/lib/mailer", () => ({
  sendEmailBestEffort: (...a: unknown[]) => sendEmailBestEffort(...a),
  escapeHtml: (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
}));

vi.mock("@/lib/site", () => ({ SITE_URL: "https://souqautos.com" }));

import {
  resolveRemoderationRecipients,
  buildRemoderationEmail,
  notifyRemoderationFlags,
} from "@/lib/listing-remoderation-notify";
import type { RemoderationResult } from "@/lib/listing-remoderation-sweep";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STAFF_ALERT_EMAILS;
});

describe("resolveRemoderationRecipients", () => {
  it("returns empty array when STAFF_ALERT_EMAILS not set", () => {
    expect(resolveRemoderationRecipients({})).toEqual([]);
  });

  it("parses comma-separated emails", () => {
    expect(
      resolveRemoderationRecipients({ STAFF_ALERT_EMAILS: "a@test.com, b@test.com" }),
    ).toEqual(["a@test.com", "b@test.com"]);
  });
});

describe("buildRemoderationEmail", () => {
  it("returns null when no flagged listings", () => {
    expect(buildRemoderationEmail({ checked: 50, flagged: [] })).toBeNull();
  });

  it("builds email for a single flagged listing", () => {
    const result: RemoderationResult = {
      checked: 100,
      flagged: [
        { id: "l1", title: "Golf 7 suspecte", oldScore: 0, newScore: 40, signals: ["duplicatePhoto"] },
      ],
    };
    const email = buildRemoderationEmail(result);
    expect(email).not.toBeNull();
    expect(email!.subject).toBe("souqautos.com — 1 annonce publiée avec nouveaux signaux");
    expect(email!.html).toContain("Golf 7 suspecte");
    expect(email!.html).toContain("score 0 → 40");
    expect(email!.html).toContain("Photo dupliquée");
    expect(email!.html).toContain("vérifié 100 annonce");
    expect(email!.html).toContain("toujours publiées");
  });

  it("pluralizes correctly for multiple flagged listings", () => {
    const result: RemoderationResult = {
      checked: 200,
      flagged: [
        { id: "l1", title: "Listing A", oldScore: 0, newScore: 35, signals: ["duplicateContent"] },
        { id: "l2", title: "Listing B", oldScore: 20, newScore: 70, signals: ["duplicatePhoto", "duplicateVin"] },
      ],
    };
    const email = buildRemoderationEmail(result);
    expect(email!.subject).toBe("souqautos.com — 2 annonces publiées avec nouveaux signaux");
    expect(email!.html).toContain("Contenu dupliqué");
    expect(email!.html).toContain("Photo dupliquée, VIN dupliqué");
  });

  it("translates all signal keys to French labels", () => {
    const result: RemoderationResult = {
      checked: 10,
      flagged: [
        {
          id: "l1",
          title: "Test",
          oldScore: 0,
          newScore: 100,
          signals: [
            "duplicatePhoto",
            "duplicateContent",
            "duplicateVin",
            "lowPrice",
            "vehicleInconsistency",
            "sellerRejectionHistory",
          ],
        },
      ],
    };
    const email = buildRemoderationEmail(result);
    expect(email!.html).toContain("Photo dupliquée");
    expect(email!.html).toContain("Contenu dupliqué");
    expect(email!.html).toContain("VIN dupliqué");
    expect(email!.html).toContain("Prix anormalement bas");
    expect(email!.html).toContain("Incohérence véhicule");
    expect(email!.html).toContain("Historique vendeur");
  });
});

describe("notifyRemoderationFlags", () => {
  it("sends nothing when no flagged listings", async () => {
    const sent = await notifyRemoderationFlags({ checked: 50, flagged: [] });
    expect(sent).toBe(0);
    expect(sendEmailBestEffort).not.toHaveBeenCalled();
  });

  it("sends nothing when no recipients configured", async () => {
    const result: RemoderationResult = {
      checked: 10,
      flagged: [{ id: "l1", title: "X", oldScore: 0, newScore: 40, signals: ["duplicatePhoto"] }],
    };
    const sent = await notifyRemoderationFlags(result);
    expect(sent).toBe(0);
  });

  it("sends email to each staff recipient", async () => {
    process.env.STAFF_ALERT_EMAILS = "mod1@test.com, mod2@test.com";
    sendEmailBestEffort.mockResolvedValue(undefined);

    const result: RemoderationResult = {
      checked: 100,
      flagged: [{ id: "l1", title: "Flagged", oldScore: 0, newScore: 35, signals: ["duplicateContent"] }],
    };
    const sent = await notifyRemoderationFlags(result);

    expect(sent).toBe(2);
    expect(sendEmailBestEffort).toHaveBeenCalledTimes(2);
    expect(sendEmailBestEffort).toHaveBeenCalledWith(
      "remoderation-sweep",
      expect.objectContaining({
        to: "mod1@test.com",
        subject: expect.stringContaining("1 annonce publiée"),
      }),
    );
    expect(sendEmailBestEffort).toHaveBeenCalledWith(
      "remoderation-sweep",
      expect.objectContaining({ to: "mod2@test.com" }),
    );
  });
});
