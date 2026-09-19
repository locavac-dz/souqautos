import { describe, expect, it } from "vitest";
import {
  algiersDayKey,
  buildDailySeries,
  contactRatePercent,
  countByDay,
  MIN_VIEWS_FOR_RATE,
  parseStatsRange,
  sortListingStats,
  sumStats,
  totalContacts,
  windowDayKeys,
  windowStart,
  type ListingStats,
} from "@/lib/pro-stats";

const stats = (overrides: Partial<ListingStats> & { listingId: string }): ListingStats => ({
  views: 0,
  favorites: 0,
  phoneReveals: 0,
  whatsappOpens: 0,
  conversations: 0,
  ...overrides,
});

describe("parseStatsRange", () => {
  it("accepts the three offered periods", () => {
    expect(parseStatsRange("7")).toBe(7);
    expect(parseStatsRange("30")).toBe(30);
    expect(parseStatsRange("90")).toBe(90);
  });

  it("falls back to 30 days for anything else that comes from the address", () => {
    for (const raw of [undefined, "", "0", "-7", "8", "365", "abc", "7.5", "30; DROP TABLE", ["nope"]]) {
      expect(parseStatsRange(raw as string), String(raw)).toBe(30);
    }
    expect(parseStatsRange(["90", "7"])).toBe(90);
  });
});

describe("algiersDayKey", () => {
  it("counts the day in Algeria time (UTC+1): 23:30 UTC already belongs to the next day", () => {
    expect(algiersDayKey(new Date("2026-09-19T22:59:59.999Z"))).toBe("2026-09-19");
    expect(algiersDayKey(new Date("2026-09-19T23:00:00.000Z"))).toBe("2026-09-20");
    expect(algiersDayKey(new Date("2026-12-31T23:30:00.000Z"))).toBe("2027-01-01");
  });

  it("does not change with the season (no daylight saving in Algeria)", () => {
    expect(algiersDayKey(new Date("2026-01-15T23:00:00Z"))).toBe("2026-01-16");
    expect(algiersDayKey(new Date("2026-07-15T23:00:00Z"))).toBe("2026-07-16");
  });
});

describe("windowDayKeys / windowStart", () => {
  const now = new Date("2026-09-19T10:00:00Z");

  it("lists the last N civil days, oldest first, today included", () => {
    const keys = windowDayKeys(7, now);
    expect(keys).toEqual(["2026-09-13", "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19"]);
    expect(windowDayKeys(30, now)).toHaveLength(30);
    expect(windowDayKeys(90, now)[0]).toBe("2026-06-22");
  });

  it("crosses month and year boundaries", () => {
    expect(windowDayKeys(3, new Date("2027-01-01T08:00:00Z"))).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
    expect(windowDayKeys(2, new Date("2028-03-01T08:00:00Z"))).toEqual(["2028-02-29", "2028-03-01"]); // année bissextile
  });

  it("starts the window at midnight Algeria time of the first day", () => {
    expect(windowStart(7, now).toISOString()).toBe("2026-09-12T23:00:00.000Z");
    // un événement de 00:30 heure d'Algérie du premier jour est dans la fenêtre, celui de 23:30 la veille non
    expect(new Date("2026-09-13T00:30:00+01:00") >= windowStart(7, now)).toBe(true);
    expect(new Date("2026-09-12T23:30:00+01:00") >= windowStart(7, now)).toBe(false);
  });

  it("uses the Algeria day even when UTC is still on the previous one", () => {
    const late = new Date("2026-09-19T23:30:00Z"); // 00:30 le 20 en Algérie
    expect(windowDayKeys(1, late)).toEqual(["2026-09-20"]);
  });
});

describe("buildDailySeries / countByDay", () => {
  const keys = ["2026-09-17", "2026-09-18", "2026-09-19"];

  it("gives one point per day, zero where nothing happened, and ignores events outside the window", () => {
    const counts = countByDay([new Date("2026-09-17T09:00:00Z"), new Date("2026-09-17T11:00:00Z"), new Date("2026-09-19T09:00:00Z"), new Date("2020-01-01T00:00:00Z")]);
    expect(buildDailySeries(keys, counts)).toEqual([
      { day: "2026-09-17", value: 2 },
      { day: "2026-09-18", value: 0 },
      { day: "2026-09-19", value: 1 },
    ]);
  });
});

describe("contactRatePercent", () => {
  it("is the share of views that led to a contact, to one decimal", () => {
    expect(contactRatePercent(200, 5)).toBe(2.5);
    expect(contactRatePercent(300, 1)).toBe(0.3);
    expect(contactRatePercent(100, 0)).toBe(0);
  });

  it("shows nothing below the minimum number of views: 2 contacts out of 3 views is not « 66,7 % »", () => {
    expect(contactRatePercent(MIN_VIEWS_FOR_RATE - 1, 2)).toBeNull();
    expect(contactRatePercent(0, 0)).toBeNull();
    expect(contactRatePercent(MIN_VIEWS_FOR_RATE, 3)).toBe(10);
  });

  it("never exceeds 100 %, even when contacts outnumber the counted views (older listing, partial history)", () => {
    expect(contactRatePercent(40, 90)).toBe(100);
  });

  it("refuses non-finite input", () => {
    expect(contactRatePercent(Number.NaN, 1)).toBeNull();
    expect(contactRatePercent(Infinity, 1)).toBeNull();
  });
});

describe("totals and sorting", () => {
  const a = stats({ listingId: "a", views: 100, favorites: 4, phoneReveals: 3, whatsappOpens: 1, conversations: 2 });
  const b = stats({ listingId: "b", views: 500, favorites: 1, phoneReveals: 0, whatsappOpens: 0, conversations: 1 });
  const c = stats({ listingId: "c", views: 100, phoneReveals: 6 });

  it("counts a contact as a number revealed (call or WhatsApp) or a conversation started — favorites and views are not contacts", () => {
    expect(totalContacts(a)).toBe(6);
    expect(totalContacts(b)).toBe(1);
  });

  it("adds up the account totals", () => {
    expect(sumStats([a, b, c])).toEqual({ views: 700, favorites: 5, phoneReveals: 9, whatsappOpens: 1, conversations: 3 });
    expect(sumStats([])).toEqual({ views: 0, favorites: 0, phoneReveals: 0, whatsappOpens: 0, conversations: 0 });
  });

  it("sorts by contacts, then views, then identifier, without touching the input", () => {
    const input = [b, a, c];
    expect(sortListingStats(input).map((s) => s.listingId)).toEqual(["a", "c", "b"]);
    expect(input.map((s) => s.listingId)).toEqual(["b", "a", "c"]);
  });
});
