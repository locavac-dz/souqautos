import { describe, expect, it, vi, beforeEach } from "vitest";

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

vi.mock("next-intl/middleware", () => ({
  default: () => ({ _type: "next", headers: new Map() }),
}));

vi.mock("@/i18n/routing", () => ({ routing: {} }));
vi.mock("@/lib/site", () => ({ SITE_URL: "http://localhost" }));
vi.mock("@/lib/security-headers", () => ({
  CSP_REPORT_PATH: "/api/security/csp-report",
  buildContentSecurityPolicy: () => "default-src 'self'",
  createNonce: () => "test-nonce",
  cspHeaderName: () => "content-security-policy",
  extraImageOrigins: () => [],
}));

import { proxy } from "@/proxy";

function req(
  path: string,
  method: string,
  headers: Record<string, string> = {}
) {
  const { NextRequest } = require("next/server");
  return new NextRequest(`http://localhost${path}`, { method, headers });
}

describe("CSRF protection in proxy", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("allows GET requests without any origin check", () => {
    const res = proxy(req("/api/listings", "GET") as any) as any;
    expect(res._type).toBe("next");
  });

  it("allows same-origin POST (Origin matches)", () => {
    const res = proxy(
      req("/api/listings", "POST", { origin: "http://localhost" }) as any
    ) as any;
    expect(res._type).toBe("next");
  });

  it("blocks cross-origin POST", () => {
    const res = proxy(
      req("/api/listings", "POST", { origin: "http://evil.com" }) as any
    ) as any;
    expect(res._type).toBe("json");
    expect(res.status).toBe(403);
  });

  it("blocks cross-site via Sec-Fetch-Site", () => {
    const res = proxy(
      req("/api/listings", "POST", { "sec-fetch-site": "cross-site" }) as any
    ) as any;
    expect(res._type).toBe("json");
    expect(res.status).toBe(403);
  });

  it("allows same-origin via Sec-Fetch-Site", () => {
    const res = proxy(
      req("/api/listings", "POST", { "sec-fetch-site": "same-origin" }) as any
    ) as any;
    expect(res._type).toBe("next");
  });

  it("allows POST without Origin or Sec-Fetch-Site (non-browser client)", () => {
    const res = proxy(req("/api/listings", "POST") as any) as any;
    expect(res._type).toBe("next");
  });

  it("exempts webhook routes", () => {
    const res = proxy(
      req("/api/webhooks/chargily", "POST", { origin: "http://evil.com" }) as any
    ) as any;
    expect(res._type).toBe("next");
  });

  it("exempts cron routes", () => {
    const res = proxy(
      req("/api/cron/sweep", "POST", { origin: "http://evil.com" }) as any
    ) as any;
    expect(res._type).toBe("next");
  });

  it("exempts CSP report endpoint", () => {
    const res = proxy(
      req("/api/security/csp-report", "POST", { origin: "http://evil.com" }) as any
    ) as any;
    expect(res._type).toBe("next");
  });

  it("uses NEXT_PUBLIC_SITE_URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://souqautos.com";
    const allowed = proxy(
      req("/api/listings", "POST", { origin: "https://souqautos.com" }) as any
    ) as any;
    expect(allowed._type).toBe("next");

    const blocked = proxy(
      req("/api/listings", "POST", { origin: "http://localhost" }) as any
    ) as any;
    expect(blocked._type).toBe("json");
    expect(blocked.status).toBe(403);
  });

  it("blocks PUT, PATCH, DELETE from cross-origin", () => {
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const res = proxy(
        req("/api/profile", method, { origin: "http://evil.com" }) as any
      ) as any;
      expect(res._type).toBe("json");
      expect(res.status).toBe(403);
    }
  });
});
