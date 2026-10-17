// Tests unitaires des en-têtes de sécurité et de la CSP par nonce (logique pure).
import { describe, it, expect } from "vitest";
import {
  readSecurityConfig,
  securityHeaders,
  buildCspValue,
  generateNonce,
} from "@/lib/http/security-headers.js";

const NONCE = "test-nonce-AAAA";

describe("readSecurityConfig", () => {
  it("valeurs par défaut : non sécurisé hors prod, mode nonce, bloquant", () => {
    const c = readSecurityConfig({});
    expect(c.secure).toBe(false);
    expect(c.isDev).toBe(false);
    expect(c.cspMode).toBe("nonce");
    expect(c.cspReportOnly).toBe(false);
    expect(c.cspOverride).toBeUndefined();
  });

  it("COOKIE_SECURE / NODE_ENV pilotent secure et isDev", () => {
    expect(readSecurityConfig({ COOKIE_SECURE: "true" }).secure).toBe(true);
    expect(readSecurityConfig({ NODE_ENV: "production" }).secure).toBe(true);
    expect(readSecurityConfig({ NODE_ENV: "development" }).isDev).toBe(true);
  });

  it("CSP_MODE sélectionne la stratégie", () => {
    expect(readSecurityConfig({ CSP_MODE: "compat" }).cspMode).toBe("compat");
    expect(readSecurityConfig({ CSP_MODE: "off" }).cspMode).toBe("off");
    expect(readSecurityConfig({ CSP_MODE: "autre" }).cspMode).toBe("nonce");
  });

  it("CONTENT_SECURITY_POLICY est prioritaire ; vide désactive", () => {
    const over = readSecurityConfig({ CONTENT_SECURITY_POLICY: "default-src 'none'" });
    expect(over.cspOverride).toBe("default-src 'none'");
    expect(readSecurityConfig({ CONTENT_SECURITY_POLICY: "" }).cspMode).toBe("off");
  });

  it("CSP_REPORT_ONLY bascule en observation", () => {
    expect(readSecurityConfig({ CSP_REPORT_ONLY: "true" }).cspReportOnly).toBe(true);
  });
});

describe("generateNonce", () => {
  it("produit des nonces non vides et distincts", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a.length).toBeGreaterThan(10);
    expect(a).not.toBe(b);
  });
});

describe("buildCspValue", () => {
  it("mode nonce : script-src strict avec nonce + strict-dynamic, sans unsafe-inline", () => {
    const csp = buildCspValue(readSecurityConfig({}), NONCE);
    expect(csp).toContain(`script-src 'self' 'nonce-${NONCE}' 'strict-dynamic'`);
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'"); // pas en prod/hors dev
    // Styles : unsafe-inline conservé (attributs de style React).
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("mode nonce + dev : tolère unsafe-eval pour les scripts", () => {
    const csp = buildCspValue(readSecurityConfig({ NODE_ENV: "development" }), NONCE);
    expect(csp).toContain(`'nonce-${NONCE}'`);
    expect(csp).toContain("'unsafe-eval'");
  });

  it("origine sécurisée : ajoute upgrade-insecure-requests", () => {
    expect(buildCspValue(readSecurityConfig({ COOKIE_SECURE: "true" }), NONCE)).toContain(
      "upgrade-insecure-requests",
    );
    expect(buildCspValue(readSecurityConfig({}), NONCE)).not.toContain("upgrade-insecure-requests");
  });

  it("mode compat : unsafe-inline sur les scripts, sans nonce", () => {
    const csp = buildCspValue(readSecurityConfig({ CSP_MODE: "compat" }), NONCE);
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("nonce-");
  });

  it("mode off / override : aucune CSP ou valeur imposée", () => {
    expect(buildCspValue(readSecurityConfig({ CSP_MODE: "off" }), NONCE)).toBe("");
    expect(buildCspValue(readSecurityConfig({ CONTENT_SECURITY_POLICY: "default-src 'none'" }), NONCE)).toBe(
      "default-src 'none'",
    );
    expect(buildCspValue(readSecurityConfig({ CONTENT_SECURITY_POLICY: "" }), NONCE)).toBe("");
  });
});

describe("securityHeaders", () => {
  it("pose les en-têtes toujours-sûrs", () => {
    const h = securityHeaders(readSecurityConfig({}), NONCE);
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["cross-origin-opener-policy"]).toBe("same-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
  });

  it("CSP bloquante par défaut, en observation si cspReportOnly", () => {
    const enf = securityHeaders(readSecurityConfig({}), NONCE);
    expect(enf["content-security-policy"]).toContain(`'nonce-${NONCE}'`);
    expect(enf["content-security-policy-report-only"]).toBeUndefined();

    const ro = securityHeaders(readSecurityConfig({ CSP_REPORT_ONLY: "true" }), NONCE);
    expect(ro["content-security-policy-report-only"]).toContain(`'nonce-${NONCE}'`);
    expect(ro["content-security-policy"]).toBeUndefined();
  });

  it("aucune CSP émise en mode off", () => {
    const h = securityHeaders(readSecurityConfig({ CSP_MODE: "off" }), NONCE);
    expect(h["content-security-policy"]).toBeUndefined();
    expect(h["content-security-policy-report-only"]).toBeUndefined();
  });

  it("HSTS seulement sur une origine sécurisée", () => {
    expect(securityHeaders(readSecurityConfig({}), NONCE)["strict-transport-security"]).toBeUndefined();
    expect(
      securityHeaders(readSecurityConfig({ COOKIE_SECURE: "true" }), NONCE)["strict-transport-security"],
    ).toContain("max-age=");
  });
});
