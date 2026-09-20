import { describe, expect, it } from "vitest";
import { CSP_REPORT_PATH, buildContentSecurityPolicy, createNonce, cspHeaderName, extraImageOrigins, staticSecurityHeaders } from "@/lib/security-headers";

const directive = (policy: string, name: string) => policy.split("; ").find((d) => d === name || d.startsWith(`${name} `));
const valueOf = (policy: string, name: string) => (directive(policy, name) ?? "").slice(name.length).trim().split(" ").filter(Boolean);

describe("createNonce", () => {
  it("is 128 bits, base64, and never repeats", () => {
    const nonces = new Set(Array.from({ length: 200 }, () => createNonce()));
    expect(nonces.size).toBe(200);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/); // 16 octets en base64
      expect(Buffer.from(nonce, "base64")).toHaveLength(16);
    }
  });
});

describe("buildContentSecurityPolicy — production", () => {
  const policy = buildContentSecurityPolicy({ nonce: "ABC123==", isDev: false, reportUri: CSP_REPORT_PATH, upgradeInsecureRequests: true });

  it("lets only scripts carrying the request's nonce run, and never allows inline or eval scripts", () => {
    expect(valueOf(policy, "script-src")).toEqual(["'self'", "'nonce-ABC123=='", "'strict-dynamic'"]);
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy.split("ABC123==")).toHaveLength(2); // le nonce n'apparaît qu'à UN endroit
  });

  it("allows nothing from outside the site by default", () => {
    expect(valueOf(policy, "default-src")).toEqual(["'self'"]);
    expect(valueOf(policy, "img-src")).toEqual(["'self'", "data:", "blob:"]);
    expect(valueOf(policy, "connect-src")).toEqual(["'self'"]);
    expect(valueOf(policy, "font-src")).toEqual(["'self'"]);
    expect(valueOf(policy, "worker-src")).toEqual(["'self'"]);
    expect(valueOf(policy, "manifest-src")).toEqual(["'self'"]);
    expect(policy).not.toMatch(/https?:\/\//);
    expect(policy).not.toContain("*");
  });

  it("forbids frames, plugins, a rewritten base address, other sites' forms, and being framed", () => {
    expect(directive(policy, "frame-src")).toBe("frame-src 'none'");
    expect(directive(policy, "object-src")).toBe("object-src 'none'");
    expect(directive(policy, "base-uri")).toBe("base-uri 'self'");
    expect(directive(policy, "form-action")).toBe("form-action 'self'");
    expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("accepts inline styles (React style attributes) but only for styles", () => {
    expect(valueOf(policy, "style-src")).toEqual(["'self'", "'unsafe-inline'"]);
  });

  it("promotes http to https, and reports violations to the site's own endpoint", () => {
    expect(policy).toContain("upgrade-insecure-requests");
    expect(directive(policy, "report-uri")).toBe("report-uri /api/security/csp-report");
  });

  it("does not promote to https when the site is not served over https (production tried on a local http address)", () => {
    expect(buildContentSecurityPolicy({ nonce: "N", isDev: false })).not.toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy({ nonce: "N", isDev: false, upgradeInsecureRequests: false })).not.toContain("upgrade-insecure-requests");
  });
});

describe("buildContentSecurityPolicy — development", () => {
  const policy = buildContentSecurityPolicy({ nonce: "N", isDev: true, upgradeInsecureRequests: true });

  it("adds only what the development tools need: eval for React's error display, and web sockets for hot reload", () => {
    expect(valueOf(policy, "script-src")).toContain("'unsafe-eval'");
    expect(valueOf(policy, "connect-src")).toEqual(["'self'", "ws:", "wss:"]);
  });

  it("never upgrades to https (the development site is served over http)", () => {
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("still keeps scripts tied to the nonce", () => {
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(valueOf(policy, "script-src")).toContain("'nonce-N'");
  });
});

describe("photo storage origin", () => {
  it("is added to img-src only, and nowhere else", () => {
    const policy = buildContentSecurityPolicy({ nonce: "N", isDev: false, imageOrigins: ["https://photos.example.dz"] });
    expect(valueOf(policy, "img-src")).toEqual(["'self'", "data:", "blob:", "https://photos.example.dz"]);
    expect(policy.split("https://photos.example.dz")).toHaveLength(2);
  });

  it("is read from S3_PUBLIC_URL as an origin (no path), and ignored when it is not an http(s) address", () => {
    expect(extraImageOrigins({ S3_PUBLIC_URL: "https://cdn.souqauto.dz/photos/abc" })).toEqual(["https://cdn.souqauto.dz"]);
    expect(extraImageOrigins({ S3_PUBLIC_URL: " http://127.0.0.1:9000/souq " })).toEqual(["http://127.0.0.1:9000"]);
    for (const bad of [undefined, "", "  ", "n-importe-quoi", "javascript:alert(1)", "ftp://x.dz", "data:text/html,x"]) {
      expect(extraImageOrigins({ S3_PUBLIC_URL: bad }), String(bad)).toEqual([]);
    }
  });

  it("cannot inject another directive through the address", () => {
    const origins = extraImageOrigins({ S3_PUBLIC_URL: "https://cdn.example.dz; script-src *" });
    const policy = buildContentSecurityPolicy({ nonce: "N", isDev: false, imageOrigins: origins });
    expect(policy.match(/script-src/g)).toHaveLength(1);
    expect(valueOf(policy, "script-src")).not.toContain("*");
  });
});

describe("cspHeaderName", () => {
  it("enforces by default, and only observes when CSP_REPORT_ONLY is exactly 1", () => {
    expect(cspHeaderName({})).toBe("Content-Security-Policy");
    expect(cspHeaderName({ CSP_REPORT_ONLY: "1" })).toBe("Content-Security-Policy-Report-Only");
    for (const value of ["0", "true", "yes", "", " 1"]) expect(cspHeaderName({ CSP_REPORT_ONLY: value }), value).toBe("Content-Security-Policy");
  });
});

describe("staticSecurityHeaders", () => {
  const headers = (production: boolean) => Object.fromEntries(staticSecurityHeaders(production).map((h) => [h.key, h.value]));

  it("always forbids sniffing, framing and unused browser features, and limits the referrer", () => {
    for (const production of [false, true]) {
      const h = headers(production);
      expect(h["X-Content-Type-Options"]).toBe("nosniff");
      expect(h["X-Frame-Options"]).toBe("DENY");
      expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["Permissions-Policy"]).toContain("camera=()");
      expect(h["Permissions-Policy"]).toContain("microphone=()");
      expect(h["Permissions-Policy"]).toContain("geolocation=()");
      expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin-allow-popups"); // le lien WhatsApp ouvre une fenêtre
    }
  });

  it("emits HSTS in production only, for a year, subdomains included, and without « preload »", () => {
    expect(headers(false)["Strict-Transport-Security"]).toBeUndefined();
    const hsts = headers(true)["Strict-Transport-Security"];
    expect(hsts).toBe("max-age=31536000; includeSubDomains");
    expect(hsts).not.toContain("preload");
  });

  it("has no duplicated header, and no header value with a line break (header injection)", () => {
    const list = staticSecurityHeaders(true);
    expect(new Set(list.map((h) => h.key)).size).toBe(list.length);
    for (const { key, value } of list) expect(`${key}${value}`).not.toMatch(/[\r\n]/);
  });
});
