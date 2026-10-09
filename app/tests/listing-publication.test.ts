// Lot 272 — effets de publication partagés entre la modération humaine et la publication automatique.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/site", () => ({ SITE_URL: "https://souqauto.example" }));

import { buildModerationEmail, publicationData } from "@/lib/listing-publication";
import { computeExpiryDate } from "@/lib/listing-lifecycle";
import { formulaValidityDays } from "@/lib/payment-orders";

const NOW = new Date("2026-10-09T12:00:00Z");
const t = (key: string, values?: Record<string, string>) => (values ? `${key}|${Object.values(values).join("|")}` : key);

describe("publicationData", () => {
  it("fixe l'expiration à la première publication, selon la formule", () => {
    const data = publicationData({ publishedAt: null, formula: "STANDARD" }, NOW, { auto: false });
    expect(data).toEqual({
      status: "PUBLIEE",
      moderationNote: null,
      publishedAt: NOW,
      autoPublishedAt: null,
      expiresAt: computeExpiryDate(NOW, formulaValidityDays("STANDARD")),
      expiryReminderSentAt: null,
    });
  });

  it("garde le cycle en cours sur une nouvelle publication (publishedAt déjà fixé)", () => {
    const first = new Date("2026-10-01T00:00:00Z");
    const data = publicationData({ publishedAt: first, formula: "PREMIUM" }, NOW, { auto: false });
    expect(data.publishedAt).toEqual(first);
    expect(data).not.toHaveProperty("expiresAt");
  });

  it("trace la décision automatique, et une approbation humaine efface cette trace", () => {
    expect(publicationData({ publishedAt: null, formula: "STANDARD" }, NOW, { auto: true }).autoPublishedAt).toEqual(NOW);
    expect(publicationData({ publishedAt: NOW, formula: "STANDARD" }, NOW, { auto: false }).autoPublishedAt).toBeNull();
  });
});

describe("buildModerationEmail", () => {
  it("approbation : lien vers l'annonce, titre échappé", () => {
    const email = buildModerationEmail(t, { outcome: "approve", title: "Clio <4>", listingId: "l1", locale: "fr" });
    expect(email.subject).toBe("listingApprovedSubject");
    expect(email.url).toBe("/fr/annonce/l1");
    expect(email.html).toContain("listingApprovedBody|Clio &lt;4&gt;");
    expect(email.html).toContain('href="https://souqauto.example/fr/annonce/l1"');
  });

  it("refus et suspension : motif transmis, lien vers « Mes annonces »", () => {
    const rejected = buildModerationEmail(t, { outcome: "reject", title: "Clio", reason: "  Photos floues ", listingId: "l1", locale: "ar" });
    expect(rejected.subject).toBe("listingRejectedSubject");
    expect(rejected.html).toContain("listingRejectedBody|Clio|Photos floues");
    expect(rejected.url).toBe("/ar/compte/mes-annonces");

    const suspended = buildModerationEmail(t, { outcome: "suspend", title: "Clio", reason: null, listingId: "l1", locale: "fr" });
    expect(suspended.subject).toBe("listingSuspendedSubject");
    expect(suspended.html).toContain("listingSuspendedBody|Clio|");
  });
});
