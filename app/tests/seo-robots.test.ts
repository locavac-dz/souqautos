import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/site", () => ({ SITE_URL: "https://souqauto.example" }));

import robots, { ROBOTS_DISALLOW } from "@/app/robots";
import { buildSearchEngineVerification, verificationStatus } from "@/lib/seo-verification";

// Interprète une règle « Disallow » comme le font Google et Bing : correspondance au début du chemin,
// « * » = n'importe quelle suite de caractères, « $ » = fin de l'adresse.
function isBlocked(path: string, rules: string[]): boolean {
  return rules.some((rule) => {
    const pattern = rule.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\$$/, "$");
    return new RegExp(`^${pattern}`).test(path);
  });
}

describe("robots.txt", () => {
  it("blocks the private areas in BOTH languages (the old rules ignored the language prefix and blocked nothing)", () => {
    for (const locale of ["fr", "ar"]) {
      for (const path of [
        `/${locale}/compte/alertes`,
        `/${locale}/compte/messages/abc`,
        `/${locale}/publier/etape-1`,
        `/${locale}/admin`,
        `/${locale}/admin/audience`,
        `/${locale}/pro/tableau-de-bord`,
        `/${locale}/pro/import`,
        `/${locale}/pro/statistiques`,
        `/${locale}/pro/prospects`,
        `/${locale}/connexion`,
        `/${locale}/inscription`,
        `/${locale}/verifier-email`,
        `/${locale}/confirmer-email`,
      ]) {
        expect(isBlocked(path, ROBOTS_DISALLOW), path).toBe(true);
      }
    }
    expect(isBlocked("/api/health", ROBOTS_DISALLOW)).toBe(true);
  });

  it("does not block anything that should be indexed", () => {
    for (const locale of ["fr", "ar"]) {
      for (const path of [
        `/${locale}`,
        `/${locale}/recherche`,
        `/${locale}/annonce/abc`,
        `/${locale}/voitures/renault/clio`,
        `/${locale}/wilaya/alger`,
        `/${locale}/mag/mon-article`,
        `/${locale}/essais/essai-clio`,
        `/${locale}/pro/cmabc123`, // vitrine publique d'un professionnel
        `/${locale}/professionnels`,
        `/${locale}/vendre`,
        `/${locale}/mentions-legales`,
      ]) {
        expect(isBlocked(path, ROBOTS_DISALLOW), path).toBe(false);
      }
    }
  });

  it("publishes the sitemap address and allows the rest", () => {
    const result = robots();
    expect(result.sitemap).toBe("https://souqauto.example/sitemap.xml");
    expect(result.rules).toMatchObject({ userAgent: "*", allow: "/", disallow: ROBOTS_DISALLOW });
  });
});

describe("search engine verification", () => {
  const google = "abcDEF1234567890_-abcDEF1234567890";

  it("emits nothing without a variable", () => {
    expect(buildSearchEngineVerification({})).toEqual({});
    expect(buildSearchEngineVerification({ GOOGLE_SITE_VERIFICATION: "  ", BING_SITE_VERIFICATION: "" })).toEqual({});
  });

  it("emits the Google and Bing tags", () => {
    expect(buildSearchEngineVerification({ GOOGLE_SITE_VERIFICATION: google })).toEqual({ verification: { google } });
    expect(buildSearchEngineVerification({ BING_SITE_VERIFICATION: "0123456789ABCDEF0123456789ABCDEF" })).toEqual({ verification: { other: { "msvalidate.01": "0123456789ABCDEF0123456789ABCDEF" } } });
    expect(buildSearchEngineVerification({ GOOGLE_SITE_VERIFICATION: ` ${google} `, BING_SITE_VERIFICATION: "0123456789ABCDEF" })).toEqual({ verification: { google, other: { "msvalidate.01": "0123456789ABCDEF" } } });
  });

  it("never injects anything but a token into the page: a pasted meta tag or a script is dropped", () => {
    for (const bad of [`<meta name="google-site-verification" content="${google}">`, `"><script>alert(1)</script>`, `${google}" onload="x`, "court", "a b c d e f g h i j", "x".repeat(300)]) {
      expect(buildSearchEngineVerification({ GOOGLE_SITE_VERIFICATION: bad }), bad).toEqual({});
      expect(buildSearchEngineVerification({ BING_SITE_VERIFICATION: bad }), bad).toEqual({});
    }
  });

  it("tells absent, valid and invalid values apart for the launch check", () => {
    expect(verificationStatus(undefined)).toBe("absent");
    expect(verificationStatus("   ")).toBe("absent");
    expect(verificationStatus(google)).toBe("valid");
    expect(verificationStatus("<meta>")).toBe("invalid");
  });
});
