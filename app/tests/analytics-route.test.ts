import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const recordPageView = vi.fn();
const purgeOldPageViews = vi.fn();
const checkRateLimit = vi.fn();
const afterCallbacks: (() => unknown)[] = [];

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => void afterCallbacks.push(fn),
}));
vi.mock("@/lib/analytics-record", () => ({
  recordPageView: (...a: unknown[]) => recordPageView(...a),
  purgeOldPageViews: (...a: unknown[]) => purgeOldPageViews(...a),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/site", () => ({ SITE_URL: "https://souqauto.example" }));

import { POST } from "@/app/api/analytics/collect/route";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

function request(body: string, headers: Record<string, string> = {}): NextRequest {
  const all: Record<string, string> = { "user-agent": CHROME, host: "souqauto.example", "x-forwarded-for": "203.0.113.5", ...headers };
  return { text: async () => body, headers: { get: (name: string) => all[name.toLowerCase()] ?? null } } as unknown as NextRequest;
}
const beacon = (path: string, referrer?: string) => JSON.stringify({ path, ...(referrer !== undefined ? { referrer } : {}) });
const flush = async () => {
  for (const fn of afterCallbacks.splice(0)) await fn();
};

beforeEach(() => {
  vi.resetAllMocks();
  afterCallbacks.length = 0;
  checkRateLimit.mockResolvedValue(true);
  recordPageView.mockResolvedValue(undefined);
  purgeOldPageViews.mockResolvedValue(0);
});

describe("POST /api/analytics/collect", () => {
  it("counts a public page view with only the derived, non-identifying values", async () => {
    const res = await POST(request(beacon("/fr/mag/mon-article?utm=x", "https://www.google.com/"), { "user-agent": IPHONE }));
    expect(res.status).toBe(204);
    await flush();
    expect(recordPageView).toHaveBeenCalledWith({ locale: "fr", page: "/mag/[slug]", detail: "mon-article", device: "mobile", referrer: "recherche" });
  });

  it("never writes the IP, the User-Agent, the query string or the referrer address", async () => {
    await POST(request(beacon("/fr/recherche?q=secret+personnel", "https://l.facebook.com/l.php?u=https://x.example/?token=SECRET"), { "user-agent": IPHONE }));
    await flush();
    const written = JSON.stringify(recordPageView.mock.calls[0][0]);
    for (const leak of ["203.0.113.5", "iPhone", "Safari", "secret", "personnel", "facebook", "token", "SECRET"]) expect(written).not.toContain(leak);
  });

  it("uses the IP only to limit the rate", async () => {
    await POST(request(beacon("/fr")));
    expect(checkRateLimit).toHaveBeenCalledWith("audience:203.0.113.5", expect.objectContaining({ limit: 600 }));
  });

  it("answers 204 and records nothing for a visitor who asked not to be tracked", async () => {
    const optOuts: Record<string, string>[] = [{ dnt: "1" }, { "sec-gpc": "1" }];
    for (const h of optOuts) {
      expect((await POST(request(beacon("/fr"), h))).status).toBe(204);
    }
    await flush();
    expect(recordPageView).not.toHaveBeenCalled();
  });

  it("answers 204 and records nothing for robots and requests without a User-Agent", async () => {
    for (const ua of ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "curl/8.4.0", "Mozilla/5.0 AppleWebKit HeadlessChrome/126.0.0.0", ""]) {
      expect((await POST(request(beacon("/fr"), { "user-agent": ua }))).status).toBe(204);
    }
    await flush();
    expect(recordPageView).not.toHaveBeenCalled();
  });

  it("answers 204 the same way, and records nothing, for anything not worth counting", async () => {
    for (const body of ["", "pas du json", beacon("/fr/compte/alertes"), beacon("/fr/admin/audience"), beacon("/en/recherche"), beacon("/fr/n-importe-quoi"), beacon("https://evil.example/fr"), beacon("/fr/mag/UPPER"), "x".repeat(2000)]) {
      const res = await POST(request(body));
      expect(res.status, body.slice(0, 40)).toBe(204);
      expect(await res.text()).toBe("");
    }
    await flush();
    expect(recordPageView).not.toHaveBeenCalled();
  });

  it("stops recording, silently, for an IP over the hourly limit", async () => {
    checkRateLimit.mockResolvedValue(false);
    expect((await POST(request(beacon("/fr")))).status).toBe(204);
    await flush();
    expect(recordPageView).not.toHaveBeenCalled();
  });

  it("tells apart the site's own pages (internal), search engines, social networks and direct access", async () => {
    const seen: string[] = [];
    for (const referrer of ["https://souqauto.example/fr/recherche", "https://www.google.dz/", "https://m.facebook.com/", "", "https://blog.exemple.dz/"]) {
      await POST(request(beacon("/fr", referrer)));
      await flush();
      seen.push(recordPageView.mock.calls.at(-1)![0].referrer);
    }
    expect(seen).toEqual(["interne", "recherche", "reseaux", "direct", "autre"]);
  });

  it("recognises the public domain as « internal » even when the Host header is an internal name", async () => {
    await POST(request(beacon("/fr", "https://souqauto.example/fr"), { host: "app-internal:3000" }));
    await flush();
    expect(recordPageView.mock.calls[0][0].referrer).toBe("interne");
  });

  it("never caches the answer", async () => {
    expect((await POST(request(beacon("/fr")))).headers.get("cache-control")).toBe("no-store");
  });

  it("purges old counters only rarely, and only after an accepted beacon", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    await POST(request(beacon("/fr")));
    await flush();
    expect(purgeOldPageViews).not.toHaveBeenCalled();
    vi.spyOn(Math, "random").mockReturnValue(0.00001);
    await POST(request(beacon("/fr")));
    await flush();
    expect(purgeOldPageViews).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});
