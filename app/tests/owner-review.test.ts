import { describe, expect, it } from "vitest";
import {
  MIN_REVIEWS_FOR_AVERAGE,
  REMOVED_AFTER_REPORT_REASON,
  checkCanWriteOwnerReview,
  computeModerationTransition,
  containsContactInfo,
  editedByAuthorUpdate,
  removedAfterReportUpdate,
  summarizeOwnerAggregate,
  summarizeOwnerRatings,
  validateRejectionReason,
} from "@/lib/owner-review";
import { ownerReviewReportSchema, ownerReviewSchema } from "@/lib/validation/owner-review";

const comment = "Voiture agréable au quotidien, sobre en ville et confortable sur autoroute après trois ans d'usage.";

describe("checkCanWriteOwnerReview", () => {
  it("requires a verified email address", () => {
    expect(checkCanWriteOwnerReview({ emailVerified: true })).toEqual({ ok: true });
    expect(checkCanWriteOwnerReview({ emailVerified: false })).toEqual({ ok: false, error: "email_not_verified" });
  });
});

describe("containsContactInfo", () => {
  it("lets an ordinary review through", () => {
    expect(containsContactInfo(comment)).toBe(false);
    expect(containsContactInfo("Consommation de 6,5 L/100 km, 45 000 km au compteur, révision à 15 000 km.")).toBe(false);
    expect(containsContactInfo("Acheté en 2022 pour 3 200 000 DA, aucune panne en 3 ans.")).toBe(false);
  });

  it("catches Algerian phone numbers in the usual spellings", () => {
    for (const text of [
      "appelez le 0555 12 34 56",
      "0555123456",
      "05 55 12 34 56",
      "0555.12.34.56",
      "+213 555 12 34 56",
      "00213555123456 ",
      "contact : +213555123456",
      "0770-12-34-56",
      "٠٥٥٥١٢٣٤٥٦", // chiffres arabo-indiens
    ]) {
      expect(containsContactInfo(text), text).toBe(true);
    }
  });

  it("catches email addresses and links", () => {
    for (const text of [
      "écrivez à moi@example.com",
      "voir https://exemple.fr/annonce",
      "www.exemple.dz",
      "sur exemple.com vous trouverez mieux",
      "visitez auto-shop.dz pour ce modèle",
    ]) {
      expect(containsContactInfo(text), text).toBe(true);
    }
  });

  it("does not mistake numbers of an ordinary review for a phone number", () => {
    expect(containsContactInfo("1.5 L dCi de 90 ch, 2019, 120 000 km")).toBe(false);
    expect(containsContactInfo("consommation 5.6 en mixte et 7.2 en ville")).toBe(false);
  });
});

describe("summarizeOwnerRatings", () => {
  it("hides the average below the minimum number of reviews, but still counts them", () => {
    expect(summarizeOwnerRatings([])).toEqual({ count: 0, average: 0, showAverage: false });
    expect(summarizeOwnerRatings([5, 4])).toEqual({ count: 2, average: 4.5, showAverage: false });
  });

  it("shows the rounded average from the minimum number of reviews", () => {
    expect(MIN_REVIEWS_FOR_AVERAGE).toBe(3);
    expect(summarizeOwnerRatings([5, 4, 4])).toEqual({ count: 3, average: 4.3, showAverage: true });
  });
});

describe("computeModerationTransition", () => {
  it("publishes or refuses a pending review", () => {
    expect(computeModerationTransition("EN_ATTENTE", "approve")).toEqual({ ok: true, newStatus: "PUBLIE" });
    expect(computeModerationTransition("EN_ATTENTE", "reject")).toEqual({ ok: true, newStatus: "REFUSE" });
  });

  it("does not moderate a review twice", () => {
    for (const status of ["PUBLIE", "REFUSE"] as const) {
      expect(computeModerationTransition(status, "approve")).toEqual({ ok: false, error: "invalid_transition" });
      expect(computeModerationTransition(status, "reject")).toEqual({ ok: false, error: "invalid_transition" });
    }
  });
});

describe("validateRejectionReason", () => {
  it("requires an explanation for the author", () => {
    expect(validateRejectionReason(undefined)).toEqual({ ok: false, error: "reason_required" });
    expect(validateRejectionReason("   ")).toEqual({ ok: false, error: "reason_required" });
    expect(validateRejectionReason("non")).toEqual({ ok: false, error: "reason_required" });
    expect(validateRejectionReason("x".repeat(301))).toEqual({ ok: false, error: "reason_required" });
    expect(validateRejectionReason("  Propos injurieux  ")).toEqual({ ok: true, reason: "Propos injurieux" });
  });
});

describe("author edits and removal after a report", () => {
  it("puts an edited review back in the queue and clears the previous decision", () => {
    expect(editedByAuthorUpdate()).toEqual({ status: "EN_ATTENTE", rejectionReason: null, moderatedAt: null, publishedAt: null });
  });

  it("unpublishes a reported review with a stated reason", () => {
    const now = new Date("2026-09-19T12:00:00Z");
    expect(removedAfterReportUpdate(now)).toEqual({
      status: "REFUSE",
      rejectionReason: REMOVED_AFTER_REPORT_REASON,
      moderatedAt: now,
      publishedAt: null,
    });
  });
});

describe("ownerReviewSchema", () => {
  const valid = { rating: 4, comment };

  it("accepts a rating from 1 to 5 with a real text", () => {
    expect(ownerReviewSchema.safeParse(valid).success).toBe(true);
    expect(ownerReviewSchema.safeParse({ ...valid, rating: 1 }).success).toBe(true);
    expect(ownerReviewSchema.safeParse({ ...valid, rating: 5 }).success).toBe(true);
  });

  it("rejects a rating outside 1–5 or a fractional one", () => {
    for (const rating of [0, 6, 3.5, -1]) {
      expect(ownerReviewSchema.safeParse({ ...valid, rating }).success).toBe(false);
    }
  });

  it("requires a text of a useful length, and caps it", () => {
    expect(ownerReviewSchema.safeParse({ ...valid, comment: "Très bien." }).success).toBe(false);
    expect(ownerReviewSchema.safeParse({ ...valid, comment: "x".repeat(2001) }).success).toBe(false);
    expect(ownerReviewSchema.safeParse({ ...valid, comment: "x".repeat(2000) }).success).toBe(true);
  });

  it("refuses contact details and links in the text", () => {
    expect(ownerReviewSchema.safeParse({ ...valid, comment: `${comment} Appelez-moi au 0555123456.` }).success).toBe(false);
    expect(ownerReviewSchema.safeParse({ ...valid, comment: `${comment} Plus d'infos sur www.exemple.dz` }).success).toBe(false);
  });

  it("bounds purchase year and mileage", () => {
    expect(ownerReviewSchema.safeParse({ ...valid, purchaseYear: 2022, mileageKm: 45000 }).success).toBe(true);
    expect(ownerReviewSchema.safeParse({ ...valid, purchaseYear: 1980 }).success).toBe(false);
    expect(ownerReviewSchema.safeParse({ ...valid, purchaseYear: new Date().getFullYear() + 1 }).success).toBe(false);
    expect(ownerReviewSchema.safeParse({ ...valid, mileageKm: -1 }).success).toBe(false);
    expect(ownerReviewSchema.safeParse({ ...valid, mileageKm: 1_000_001 }).success).toBe(false);
  });
});

describe("ownerReviewReportSchema", () => {
  it("accepts the reasons meant for reviews and asks for details on « other »", () => {
    expect(ownerReviewReportSchema.safeParse({ reason: "CONTENU_INAPPROPRIE" }).success).toBe(true);
    expect(ownerReviewReportSchema.safeParse({ reason: "FRAUDE_SUSPECTEE" }).success).toBe(true);
    expect(ownerReviewReportSchema.safeParse({ reason: "AUTRE" }).success).toBe(false);
    expect(ownerReviewReportSchema.safeParse({ reason: "AUTRE", comment: "Avis de complaisance" }).success).toBe(true);
  });

  it("refuses reasons that only make sense for listings or users", () => {
    for (const reason of ["VEHICULE_VOLE", "PRIX_SUSPECT", "USURPATION_IDENTITE", "INCONNU"]) {
      expect(ownerReviewReportSchema.safeParse({ reason }).success).toBe(false);
    }
  });
});

describe("summarizeOwnerAggregate", () => {
  it("rounds the average to one decimal and applies the same minimum", () => {
    expect(summarizeOwnerAggregate(4.333333, 3)).toEqual({ count: 3, average: 4.3, showAverage: true });
    expect(summarizeOwnerAggregate(5, 2)).toEqual({ count: 2, average: 5, showAverage: false });
    expect(summarizeOwnerAggregate(null, 0)).toEqual({ count: 0, average: 0, showAverage: false });
  });
});
