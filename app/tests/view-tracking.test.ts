import { beforeEach, describe, expect, it, vi } from "vitest";

const listingUpdate = vi.fn();
const executeRaw = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: { update: (...a: unknown[]) => listingUpdate(...a) },
    $executeRaw: (...a: unknown[]) => executeRaw(...a),
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));

import { isLikelyBot, recordListingView } from "@/lib/view-tracking";

describe("isLikelyBot", () => {
  it("lets real browsers through", () => {
    for (const ua of [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
    ]) {
      expect(isLikelyBot(ua), ua).toBe(false);
    }
  });

  it("recognises indexing robots, link previews, monitoring and HTTP libraries", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Mozilla/5.0 (compatible; YandexBot/3.0)",
      "Mozilla/5.0 (compatible; AhrefsBot/7.0)",
      "WhatsApp/2.23.20.0 A",
      "Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Preview/0.5",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36",
      "curl/8.4.0",
      "Wget/1.21",
      "python-requests/2.31.0",
      "node-fetch/1.0",
      "axios/1.6.0",
      "Go-http-client/2.0",
      "UptimeRobot/2.0",
      "Mozilla/5.0 (compatible; Site24x7 monitor)",
    ]) {
      expect(isLikelyBot(ua), ua).toBe(true);
    }
  });

  it("treats a request with no User-Agent as not a browser", () => {
    expect(isLikelyBot(null)).toBe(true);
    expect(isLikelyBot(undefined)).toBe(true);
    expect(isLikelyBot("")).toBe(true);
  });
});

describe("recordListingView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listingUpdate.mockReturnValue("total-op");
    executeRaw.mockReturnValue("day-op");
    transaction.mockResolvedValue([]);
  });

  it("bumps the total and the daily counter in ONE transaction, so they never drift apart", async () => {
    await recordListingView("listing1");
    expect(listingUpdate).toHaveBeenCalledWith({ where: { id: "listing1" }, data: { views: { increment: 1 } } });
    expect(transaction).toHaveBeenCalledWith(["total-op", "day-op"]);
  });

  it("writes the daily counter as an atomic upsert on the Algeria calendar day, with the id as a bound parameter", async () => {
    await recordListingView("listing'; DROP TABLE x;--");
    const [strings, ...values] = executeRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const sql = strings.join("?");
    expect(sql).toContain('INSERT INTO "ListingViewDay"');
    expect(sql).toContain("ON CONFLICT");
    expect(sql).toContain('"count" = "ListingViewDay"."count" + 1');
    expect(sql).toContain("Africa/Algiers");
    expect(values).toEqual(["listing'; DROP TABLE x;--"]); // jamais concaténé dans la requête
    expect(sql).not.toContain("DROP TABLE");
  });

  it("never throws: a failing statistic must not break the listing page", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    transaction.mockRejectedValue(new Error("connection lost"));
    await expect(recordListingView("listing1")).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("connection lost"));
    spy.mockRestore();
  });
});
