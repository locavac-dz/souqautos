// Tests unitaires des en-têtes de sécurité (logique pure, sans base).
import { describe, it, expect } from "vitest";
import {
  readSecurityConfig,
  securityHeaders,
  applySecurityHeaders,
  CSP_DEFAUT,
} from "@/lib/http/security-headers.js";

describe("readSecurityConfig", () => {
  it("secure=false par défaut hors production, CSP par défaut, bloquante", () => {
    const c = readSecurityConfig({});
    expect(c.secure).toBe(false);
    expect(c.csp).toBe(CSP_DEFAUT);
    expect(c.cspReportOnly).toBe(false);
  });

  it("COOKIE_SECURE=true force une origine sécurisée", () => {
    expect(readSecurityConfig({ COOKIE_SECURE: "true" }).secure).toBe(true);
  });

  it("NODE_ENV=production implique secure sans COOKIE_SECURE explicite", () => {
    expect(readSecurityConfig({ NODE_ENV: "production" }).secure).toBe(true);
  });

  it("CONTENT_SECURITY_POLICY remplace la politique ; vide la désactive", () => {
    expect(readSecurityConfig({ CONTENT_SECURITY_POLICY: "default-src 'none'" }).csp).toBe(
      "default-src 'none'",
    );
    expect(readSecurityConfig({ CONTENT_SECURITY_POLICY: "" }).csp).toBe("");
  });

  it("CSP_REPORT_ONLY=true passe la CSP en observation", () => {
    expect(readSecurityConfig({ CSP_REPORT_ONLY: "true" }).cspReportOnly).toBe(true);
  });
});

describe("securityHeaders", () => {
  it("pose les en-têtes toujours-sûrs", () => {
    const h = securityHeaders(readSecurityConfig({}));
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["cross-origin-opener-policy"]).toBe("same-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
  });

  it("CSP bloquante par défaut, en observation si cspReportOnly", () => {
    const enf = securityHeaders(readSecurityConfig({}));
    expect(enf["content-security-policy"]).toBe(CSP_DEFAUT);
    expect(enf["content-security-policy-report-only"]).toBeUndefined();

    const ro = securityHeaders(readSecurityConfig({ CSP_REPORT_ONLY: "true" }));
    expect(ro["content-security-policy-report-only"]).toBe(CSP_DEFAUT);
    expect(ro["content-security-policy"]).toBeUndefined();
  });

  it("la CSP par défaut conserve les directives structurantes", () => {
    expect(CSP_DEFAUT).toContain("frame-ancestors 'none'");
    expect(CSP_DEFAUT).toContain("object-src 'none'");
    expect(CSP_DEFAUT).toContain("base-uri 'self'");
    expect(CSP_DEFAUT).toContain("form-action 'self'");
  });

  it("aucune CSP émise si la politique est vide", () => {
    const h = securityHeaders(readSecurityConfig({ CONTENT_SECURITY_POLICY: "" }));
    expect(h["content-security-policy"]).toBeUndefined();
    expect(h["content-security-policy-report-only"]).toBeUndefined();
  });

  it("HSTS seulement sur une origine sécurisée", () => {
    expect(securityHeaders(readSecurityConfig({}))["strict-transport-security"]).toBeUndefined();
    expect(
      securityHeaders(readSecurityConfig({ COOKIE_SECURE: "true" }))["strict-transport-security"],
    ).toContain("max-age=");
  });
});

describe("applySecurityHeaders", () => {
  it("mute un objet Headers en place", () => {
    const headers = new Headers();
    applySecurityHeaders(headers, readSecurityConfig({ COOKIE_SECURE: "true" }));
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("content-security-policy")).toBe(CSP_DEFAUT);
    expect(headers.get("strict-transport-security")).toContain("max-age=");
  });
});
