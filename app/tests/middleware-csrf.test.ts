import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// The middleware uses NextResponse and NextRequest from next/server.
// In the test environment we mock them minimally.

vi.mock("next/server", () => {
  class FakeURL {
    pathname: string;
    origin: string;
    constructor(input: string, base?: string) {
      const u = new URL(input, base ?? "http://localhost");
      this.pathname = u.pathname;
      this.origin = u.origin;
    }
  }

  class MockNextRequest {
    method: string;
    headers: Map<string, string>;
    nextUrl: { pathname: string; origin: string };
    constructor(url: string, opts: { method?: string; headers?: Record<string, string> } = {}) {
      this.method = opts.method ?? "GET";
      const u = new FakeURL(url);
      this.nextUrl = { pathname: u.pathname, origin: u.origin };
      this.headers = new Map(Object.entries(opts.headers ?? {}));
    }
  }

  const NextResponse = {
    json: (body: unknown, init?: { status?: number }) => ({
      _type: "json",
      body,
      status: init?.status ?? 200,
    }),
    next: () => ({ _type: "next" }),
  };

  return { NextRequest: MockNextRequest, NextResponse };
});

// Import after mock is set up.
import { middleware } from "@/middleware";

// Shape of the responses produced by the NextResponse mock above.
type MockResponse = { _type: "json" | "next"; status?: number; body?: unknown };

// "next/server" is mocked, so NextRequest is MockNextRequest at runtime: the cast only
// bridges the mock to the real type expected by `middleware`.
function run(
  path: string,
  method: string,
  headers: Record<string, string> = {}
): MockResponse {
  const request = new NextRequest(`http://localhost${path}`, { method, headers });
  return middleware(request) as unknown as MockResponse;
}

describe("CSRF middleware", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("allows GET requests without any origin check", () => {
    const res = run("/api/listings", "GET");
    expect(res._type).toBe("next");
  });

  it("allows same-origin POST (Origin matches)", () => {
    const res = run("/api/listings", "POST", { origin: "http://localhost" });
    expect(res._type).toBe("next");
  });

  it("blocks cross-origin POST", () => {
    const res = run("/api/listings", "POST", { origin: "http://evil.com" });
    expect(res._type).toBe("json");
    expect(res.status).toBe(403);
  });

  it("blocks cross-site via Sec-Fetch-Site", () => {
    const res = run("/api/listings", "POST", { "sec-fetch-site": "cross-site" });
    expect(res._type).toBe("json");
    expect(res.status).toBe(403);
  });

  it("allows same-origin via Sec-Fetch-Site", () => {
    const res = run("/api/listings", "POST", { "sec-fetch-site": "same-origin" });
    expect(res._type).toBe("next");
  });

  it("allows POST without Origin or Sec-Fetch-Site (non-browser client)", () => {
    const res = run("/api/listings", "POST");
    expect(res._type).toBe("next");
  });

  it("exempts webhook routes", () => {
    const res = run("/api/webhooks/chargily", "POST", { origin: "http://evil.com" });
    expect(res._type).toBe("next");
  });

  it("exempts cron routes", () => {
    const res = run("/api/cron/sweep", "POST", { origin: "http://evil.com" });
    expect(res._type).toBe("next");
  });

  it("exempts CSP report endpoint", () => {
    const res = run("/api/security/csp-report", "POST", { origin: "http://evil.com" });
    expect(res._type).toBe("next");
  });

  it("uses NEXT_PUBLIC_SITE_URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://souqautos.com";
    const allowed = run("/api/listings", "POST", { origin: "https://souqautos.com" });
    expect(allowed._type).toBe("next");

    const blocked = run("/api/listings", "POST", { origin: "http://localhost" });
    expect(blocked._type).toBe("json");
    expect(blocked.status).toBe(403);
  });

  it("blocks PUT, PATCH, DELETE from cross-origin", () => {
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const res = run("/api/profile", method, { origin: "http://evil.com" });
      expect(res._type).toBe("json");
      expect(res.status).toBe(403);
    }
  });
});
