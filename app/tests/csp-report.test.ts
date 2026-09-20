import { describe, expect, it } from "vitest";
import { isBrowserExtensionNoise, parseCspReport, redactPath, reduceUrl } from "@/lib/csp-report";

const TOKEN = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

describe("redactPath", () => {
  it("masks anything that looks like a token or an identifier, wherever it is in the path", () => {
    expect(redactPath(`/fr/reinitialiser-mot-de-passe/${TOKEN}`)).toBe("/fr/reinitialiser-mot-de-passe/[…]");
    expect(redactPath("/fr/annonce/cmu90fb5800033aj4wajbrs70")).toBe("/fr/annonce/[…]");
    expect(redactPath(`/fr/verifier-email/${"9f2c1ab7".repeat(8)}`)).toBe("/fr/verifier-email/[…]");
  });

  it("keeps ordinary pages readable", () => {
    expect(redactPath("/fr/recherche")).toBe("/fr/recherche");
    expect(redactPath("/fr/voitures/renault/clio")).toBe("/fr/voitures/renault/clio");
    // Mots longs mais lisibles : ils restent visibles, sans quoi un rapport ne dirait plus de quelle page il s'agit.
    for (const page of ["/fr/reinitialiser-mot-de-passe", "/fr/conditions-generales", "/fr/politique-confidentialite", "/fr/essais/revue-de-presse", "/ar/mot-de-passe-oublie"]) {
      expect(redactPath(page), page).toBe(page);
    }
    expect(redactPath("/fr/annonce")).toBe("/fr/annonce");
  });
});

describe("reduceUrl", () => {
  it("keeps origin and masked path, drops the query and the fragment (they may hold searches or tokens)", () => {
    expect(reduceUrl(`https://souqauto.dz/fr/recherche?q=secret-personnel&token=${TOKEN}#haut`)).toBe("https://souqauto.dz/fr/recherche");
    expect(reduceUrl(`https://souqauto.dz/fr/reinitialiser-mot-de-passe/${TOKEN}?a=1`)).toBe("https://souqauto.dz/fr/reinitialiser-mot-de-passe/[…]");
    expect(reduceUrl("http://localhost:5185/fr")).toBe("http://localhost:5185/fr");
    expect(reduceUrl("wss://souqauto.dz/_next/hmr?id=abc")).toBe("wss://souqauto.dz/_next/hmr");
  });

  it("keeps the well-known keywords, names the scheme of other addresses, and marks anything else", () => {
    for (const keyword of ["inline", "eval", "data", "blob", "self"]) expect(reduceUrl(keyword)).toBe(keyword);
    expect(reduceUrl("chrome-extension://abcdef/content.js")).toBe("chrome-extension");
    expect(reduceUrl("moz-extension://x/y.js")).toBe("moz-extension");
    expect(reduceUrl("data:text/html,<script>alert(1)</script>")).toBe("data");
    expect(reduceUrl("javascript:alert(document.cookie)")).toBe("javascript");
    expect(reduceUrl("pas une adresse du tout")).toBe("autre");
  });

  it("returns an empty string for a missing or non-text value, and never returns more than 200 characters of a long address", () => {
    for (const value of [undefined, null, "", 12, {}, []]) expect(reduceUrl(value)).toBe("");
    expect(reduceUrl(`https://souqauto.dz/${"a/".repeat(300)}`).length).toBeLessThanOrEqual(200);
  });
});

describe("parseCspReport — legacy format (report-uri)", () => {
  const body = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      "csp-report": {
        "document-uri": `https://souqauto.dz/fr/reinitialiser-mot-de-passe/${TOKEN}?x=1`,
        "violated-directive": "script-src-elem 'self' 'nonce-xxx'",
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://evil.example/x.js?cookie=abc",
        "source-file": "https://souqauto.dz/fr/recherche",
        "line-number": 42,
        "original-policy": "default-src 'self'; script-src 'nonce-SECRET'",
        ...overrides,
      },
    });

  it("keeps only the useful, non-personal fields — never the policy (it holds the nonce), the query or the token", () => {
    const violation = parseCspReport(body());
    expect(violation).toEqual({
      directive: "script-src-elem",
      blocked: "https://evil.example/x.js",
      page: "https://souqauto.dz/fr/reinitialiser-mot-de-passe/[…]",
      source: "https://souqauto.dz/fr/recherche",
      line: 42,
    });
    const text = JSON.stringify(violation);
    for (const secret of [TOKEN, "cookie=abc", "nonce", "SECRET", "x=1"]) expect(text).not.toContain(secret);
  });

  it("falls back to the violated directive, and cleans the directive name", () => {
    expect(parseCspReport(body({ "effective-directive": undefined, "violated-directive": "img-src 'self' data:" }))?.directive).toBe("img-src");
    const cleaned = parseCspReport(body({ "effective-directive": "script-src<b>x</b>\n" }))?.directive ?? "";
    expect(cleaned).toMatch(/^[a-z-]+$/); // ni balise, ni saut de ligne : la ligne de journal ne peut pas être falsifiée
  });

  it("accepts inline and eval violations, and ignores an absurd line number", () => {
    expect(parseCspReport(body({ "blocked-uri": "inline", "line-number": -5 }))).toMatchObject({ blocked: "inline", line: null });
    expect(parseCspReport(body({ "blocked-uri": "eval", "line-number": 1e12 }))).toMatchObject({ blocked: "eval", line: null });
  });
});

describe("parseCspReport — Reporting API format", () => {
  it("reads a csp-violation entry, ignoring other report types", () => {
    const text = JSON.stringify([
      { type: "deprecation", body: { id: "x" } },
      { type: "csp-violation", body: { documentURL: "https://souqauto.dz/fr/guides?q=1", effectiveDirective: "img-src", blockedURL: "https://cdn.example/a.png", sourceFile: "", lineNumber: 7 } },
    ]);
    expect(parseCspReport(text)).toEqual({ directive: "img-src", blocked: "https://cdn.example/a.png", page: "https://souqauto.dz/fr/guides", source: "", line: 7 });
  });

  it("returns null when there is no csp-violation entry", () => {
    expect(parseCspReport(JSON.stringify([{ type: "deprecation", body: {} }]))).toBeNull();
    expect(parseCspReport("[]")).toBeNull();
  });
});

describe("parseCspReport — rejects anything else", () => {
  it("returns null for empty, oversized, malformed or unrelated content, without throwing", () => {
    for (const text of ["", "pas du json", "null", "12", '"texte"', "{}", '{"a":1}', "[1,2,3]", "x".repeat(9000), '{"csp-report":null}', '{"csp-report":"texte"}']) {
      expect(parseCspReport(text), text.slice(0, 30)).toBeNull();
    }
  });
});

describe("isBrowserExtensionNoise", () => {
  const violation = (overrides: Record<string, string>) => ({ directive: "script-src-elem", blocked: "inline", page: "https://souqauto.dz/fr", source: "", line: null, ...overrides });

  it("recognizes violations caused by a browser extension, which say nothing about the site", () => {
    expect(isBrowserExtensionNoise(violation({ blocked: "chrome-extension" }))).toBe(true);
    expect(isBrowserExtensionNoise(violation({ source: "moz-extension" }))).toBe(true);
    expect(isBrowserExtensionNoise(violation({ blocked: "safari-web-extension" }))).toBe(true);
  });

  it("keeps real violations", () => {
    expect(isBrowserExtensionNoise(violation({}))).toBe(false);
    expect(isBrowserExtensionNoise(violation({ blocked: "https://evil.example/x.js" }))).toBe(false);
  });
});
