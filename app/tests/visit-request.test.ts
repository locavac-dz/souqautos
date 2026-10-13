import { describe, expect, it } from "vitest";
import {
  checkProposedDate,
  checkCanRequestVisit,
  checkCanRespond,
  checkCanCancel,
  MIN_HOURS_AHEAD,
  MAX_DAYS_AHEAD,
  MAX_PENDING_PER_BUYER,
} from "@/lib/visit-request";

describe("checkProposedDate", () => {
  const now = new Date("2026-10-13T10:00:00Z");

  it("rejects a date less than MIN_HOURS_AHEAD in the future", () => {
    const tooSoon = new Date(now.getTime() + (MIN_HOURS_AHEAD - 1) * 60 * 60 * 1000);
    expect(checkProposedDate(tooSoon, now)).toBe("too_soon");
  });

  it("accepts a date exactly MIN_HOURS_AHEAD in the future", () => {
    const justRight = new Date(now.getTime() + MIN_HOURS_AHEAD * 60 * 60 * 1000);
    expect(checkProposedDate(justRight, now)).toBeNull();
  });

  it("rejects a date more than MAX_DAYS_AHEAD in the future", () => {
    const tooFar = new Date(now.getTime() + (MAX_DAYS_AHEAD + 1) * 24 * 60 * 60 * 1000);
    expect(checkProposedDate(tooFar, now)).toBe("too_far");
  });

  it("accepts a date within the valid window", () => {
    const ok = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(checkProposedDate(ok, now)).toBeNull();
  });

  it("rejects a date in the past", () => {
    const past = new Date(now.getTime() - 60 * 60 * 1000);
    expect(checkProposedDate(past, now)).toBe("too_soon");
  });
});

describe("checkCanRequestVisit", () => {
  it("rejects self-visit", () => {
    expect(checkCanRequestVisit("user1", "user1", "PUBLIEE", 0, 0)).toBe("self_visit");
  });

  it("rejects non-published listing", () => {
    expect(checkCanRequestVisit("buyer", "seller", "VENDUE", 0, 0)).toBe("listing_not_published");
    expect(checkCanRequestVisit("buyer", "seller", "EN_ATTENTE", 0, 0)).toBe("listing_not_published");
    expect(checkCanRequestVisit("buyer", "seller", "EXPIREE", 0, 0)).toBe("listing_not_published");
  });

  it("rejects when buyer already has a pending request for this listing", () => {
    expect(checkCanRequestVisit("buyer", "seller", "PUBLIEE", 1, 1)).toBe("already_pending");
  });

  it("rejects when buyer has too many total pending requests", () => {
    expect(checkCanRequestVisit("buyer", "seller", "PUBLIEE", 0, MAX_PENDING_PER_BUYER)).toBe("too_many_pending");
  });

  it("accepts a valid request", () => {
    expect(checkCanRequestVisit("buyer", "seller", "PUBLIEE", 0, 0)).toBeNull();
  });

  it("accepts when buyer has some but not too many pending requests", () => {
    expect(checkCanRequestVisit("buyer", "seller", "PUBLIEE", 0, MAX_PENDING_PER_BUYER - 1)).toBeNull();
  });
});

describe("checkCanRespond", () => {
  it("allows responding to EN_ATTENTE", () => {
    expect(checkCanRespond("EN_ATTENTE")).toBe(true);
  });

  it("disallows responding to other statuses", () => {
    expect(checkCanRespond("CONFIRMEE")).toBe(false);
    expect(checkCanRespond("DECLINEE")).toBe(false);
    expect(checkCanRespond("ANNULEE")).toBe(false);
    expect(checkCanRespond("TERMINEE")).toBe(false);
  });
});

describe("checkCanCancel", () => {
  it("allows cancelling EN_ATTENTE", () => {
    expect(checkCanCancel("EN_ATTENTE")).toBe(true);
  });

  it("allows cancelling CONFIRMEE", () => {
    expect(checkCanCancel("CONFIRMEE")).toBe(true);
  });

  it("disallows cancelling terminal statuses", () => {
    expect(checkCanCancel("DECLINEE")).toBe(false);
    expect(checkCanCancel("ANNULEE")).toBe(false);
    expect(checkCanCancel("TERMINEE")).toBe(false);
  });
});
