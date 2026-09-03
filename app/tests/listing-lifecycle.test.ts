import { describe, expect, it } from "vitest";
import {
  LISTING_VALIDITY_DAYS,
  checkListingCanBeMarkedSold,
  checkListingContentEditable,
  checkListingPriceEditable,
  checkListingRenewable,
  computeExpiryDate,
  isListingExpired,
  isPriceDrop,
} from "@/lib/listing-lifecycle";

describe("computeExpiryDate", () => {
  it("adds LISTING_VALIDITY_DAYS days by default", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const expiry = computeExpiryDate(from);
    expect(expiry.getTime() - from.getTime()).toBe(LISTING_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  });

  it("accepts a custom duration", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const expiry = computeExpiryDate(from, 7);
    expect(expiry.getTime() - from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("isListingExpired", () => {
  const now = new Date("2026-06-15T00:00:00.000Z");

  it("is not expired when expiresAt is null", () => {
    expect(isListingExpired(null, now)).toBe(false);
  });

  it("is not expired before expiresAt", () => {
    expect(isListingExpired(new Date("2026-06-16T00:00:00.000Z"), now)).toBe(false);
  });

  it("is expired exactly at expiresAt", () => {
    expect(isListingExpired(new Date("2026-06-15T00:00:00.000Z"), now)).toBe(true);
  });

  it("is expired after expiresAt", () => {
    expect(isListingExpired(new Date("2026-06-14T00:00:00.000Z"), now)).toBe(true);
  });
});

describe("checkListingRenewable", () => {
  it("allows renewal from PUBLIEE and EXPIREE", () => {
    expect(checkListingRenewable("PUBLIEE")).toEqual({ ok: true });
    expect(checkListingRenewable("EXPIREE")).toEqual({ ok: true });
  });

  it("blocks renewal from every other status", () => {
    for (const status of ["BROUILLON", "EN_ATTENTE", "SUSPENDUE", "REFUSEE", "VENDUE"] as const) {
      expect(checkListingRenewable(status)).toEqual({ ok: false, error: "invalid_status" });
    }
  });
});

describe("checkListingContentEditable", () => {
  it("allows editing content from PUBLIEE and EXPIREE", () => {
    expect(checkListingContentEditable("PUBLIEE")).toEqual({ ok: true });
    expect(checkListingContentEditable("EXPIREE")).toEqual({ ok: true });
  });

  // Lot 41 — import de stock en masse : une annonce importée nait en
  // BROUILLON sans photo, l'édition existante est son seul chemin pour en
  // ajouter et repasser en modération.
  it("allows editing content from BROUILLON (Lot 41 — bulk-imported drafts)", () => {
    expect(checkListingContentEditable("BROUILLON")).toEqual({ ok: true });
  });

  it("blocks editing content from every other status", () => {
    for (const status of ["EN_ATTENTE", "SUSPENDUE", "REFUSEE", "VENDUE"] as const) {
      expect(checkListingContentEditable(status)).toEqual({ ok: false, error: "invalid_status" });
    }
  });
});

describe("checkListingCanBeMarkedSold", () => {
  it("allows marking sold from PUBLIEE and EXPIREE", () => {
    expect(checkListingCanBeMarkedSold("PUBLIEE")).toEqual({ ok: true });
    expect(checkListingCanBeMarkedSold("EXPIREE")).toEqual({ ok: true });
  });

  it("blocks marking sold from every other status", () => {
    for (const status of ["BROUILLON", "EN_ATTENTE", "SUSPENDUE", "REFUSEE", "VENDUE"] as const) {
      expect(checkListingCanBeMarkedSold(status)).toEqual({ ok: false, error: "invalid_status" });
    }
  });
});

describe("checkListingPriceEditable", () => {
  it("allows editing the price from PUBLIEE and EXPIREE", () => {
    expect(checkListingPriceEditable("PUBLIEE")).toEqual({ ok: true });
    expect(checkListingPriceEditable("EXPIREE")).toEqual({ ok: true });
  });

  it("blocks editing the price from every other status", () => {
    for (const status of ["BROUILLON", "EN_ATTENTE", "SUSPENDUE", "REFUSEE", "VENDUE"] as const) {
      expect(checkListingPriceEditable(status)).toEqual({ ok: false, error: "invalid_status" });
    }
  });
});

describe("isPriceDrop", () => {
  it("is a drop when the new price is lower", () => {
    expect(isPriceDrop(2_000_000, 1_800_000)).toBe(true);
  });

  it("is not a drop when the price is unchanged", () => {
    expect(isPriceDrop(2_000_000, 2_000_000)).toBe(false);
  });

  it("is not a drop when the new price is higher", () => {
    expect(isPriceDrop(2_000_000, 2_200_000)).toBe(false);
  });
});
