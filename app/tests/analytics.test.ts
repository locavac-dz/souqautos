import { describe, expect, it } from "vitest";
import {
  MAX_BEACON_BYTES,
  PUBLIC_PAGES,
  classifyDevice,
  classifyPublicPath,
  classifyReferrer,
  isTrackingOptOut,
  parseBeacon,
} from "@/lib/analytics";

describe("classifyPublicPath — pages counted", () => {
  const cases: [string, string, string, string][] = [
    ["/fr", "fr", "/", ""],
    ["/fr/", "fr", "/", ""],
    ["/ar", "ar", "/", ""],
    ["/fr/recherche", "fr", "/recherche", ""],
    ["/ar/annonce/cmu8obm9e00003aqoq4vqcc7j", "ar", "/annonce/[id]", ""],
    ["/fr/voitures", "fr", "/voitures", ""],
    ["/fr/voitures/renault", "fr", "/voitures/[marque]", "renault"],
    ["/fr/voitures/renault/clio", "fr", "/voitures/[marque]/[modele]", "renault/clio"],
    ["/fr/wilaya/alger", "fr", "/wilaya/[wilaya]", "alger"],
    ["/fr/mag/comment-acheter-une-occasion", "fr", "/mag/[slug]", "comment-acheter-une-occasion"],
    ["/ar/essais/essai-clio-4", "ar", "/essais/[slug]", "essai-clio-4"],
    ["/fr/guides", "fr", "/guides", ""],
    ["/fr/guides/acheter-une-clio-4-d-occasion", "fr", "/guides/[slug]", "acheter-une-clio-4-d-occasion"],
    ["/ar/guides/guide-clio", "ar", "/guides/[slug]", "guide-clio"],
    ["/fr/pro/cmabc123", "fr", "/pro/[id]", ""],
    ["/fr/vendeur/cmabc123", "fr", "/vendeur/[id]", ""],
    ["/fr/professionnels", "fr", "/professionnels", ""],
    ["/fr/politique-confidentialite", "fr", "/politique-confidentialite", ""],
  ];
  it.each(cases)("%s → %s %s", (path, locale, page, detail) => {
    expect(classifyPublicPath(path)).toEqual({ locale, page, detail });
  });

  it("only ever produces a page from the closed list", () => {
    for (const [path] of cases) expect(PUBLIC_PAGES).toContain(classifyPublicPath(path)!.page);
  });
});

describe("classifyPublicPath — never counted", () => {
  it("ignores everything private: account, publishing, administration, the pro tools, tokens", () => {
    for (const path of [
      "/fr/compte/alertes",
      "/fr/compte/messages/abc",
      "/fr/publier/etape-3",
      "/fr/admin",
      "/fr/admin/audience",
      "/fr/pro/tableau-de-bord",
      "/fr/pro/statistiques",
      "/fr/pro/prospects",
      "/fr/pro/import",
      "/fr/verifier-email",
      "/fr/confirmer-email",
    ]) {
      expect(classifyPublicPath(path), path).toBeNull();
    }
  });

  it("ignores unknown pages, other languages, missing or malformed paths", () => {
    for (const path of ["/fr/n-importe-quoi", "/fr/annonce", "/fr/annonce/a/b", "/fr/voitures/a/b/c", "/en/recherche", "/recherche", "recherche", "", "//evil.example", "https://evil.example/fr"]) {
      expect(classifyPublicPath(path), path).toBeNull();
    }
    expect(classifyPublicPath(undefined as unknown as string)).toBeNull();
    expect(classifyPublicPath(42 as unknown as string)).toBeNull();
    expect(classifyPublicPath("/fr/" + "a".repeat(400))).toBeNull();
  });

  it("does not treat inherited object keys as pages", () => {
    for (const segment of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(classifyPublicPath(`/fr/${segment}`), segment).toBeNull();
    }
  });
});

describe("classifyPublicPath — privacy of the address", () => {
  it("drops the query string and the fragment without reading them (searches, tokens, e-mails)", () => {
    expect(classifyPublicPath("/fr/recherche?q=renault+clio&priceMax=900000")).toEqual({ locale: "fr", page: "/recherche", detail: "" });
    expect(classifyPublicPath("/fr/recherche#resultats")).toEqual({ locale: "fr", page: "/recherche", detail: "" });
    expect(classifyPublicPath("/fr/mag/mon-article?token=SECRET&email=a@b.dz")!.detail).toBe("mon-article");
  });

  it("never keeps an identifier of a listing, a seller or a professional showcase", () => {
    for (const path of ["/fr/annonce/cmu8obm9e00003aqoq4vqcc7j", "/fr/vendeur/cmabc123", "/fr/pro/cmabc123"]) {
      expect(classifyPublicPath(path)!.detail, path).toBe("");
    }
  });

  it("keeps a content detail only when it looks like a public slug: no free text, no traversal, no encoded slash", () => {
    for (const path of [
      "/fr/mag/Article%20Avec%20Espaces",
      "/fr/mag/UPPERCASE",
      "/fr/guides/Guide%20Avec%20Espaces",
      "/fr/guides/..%2fadmin",
      "/fr/mag/a_b",
      "/fr/mag/%2e%2e",
      "/fr/mag/..%2fadmin",
      "/fr/mag/a%2Fb",
      "/fr/mag/%E0%A4%A", // encodage invalide
      "/fr/mag/" + "a".repeat(81),
      "/fr/mag/-commence-par-un-tiret",
      "/fr/voitures/renault/CLIO",
      "/fr/wilaya/alger%00",
    ]) {
      expect(classifyPublicPath(path), path).toBeNull();
    }
  });
});

describe("classifyReferrer", () => {
  const own = "souqauto.example";

  it("says « direct » when there is no usable referrer", () => {
    for (const referrer of [undefined, null, "", "pas une adresse"]) expect(classifyReferrer(referrer, own)).toBe("direct");
  });

  it("recognises the site itself, with or without a subdomain and a port", () => {
    expect(classifyReferrer("https://souqauto.example/fr/recherche", own)).toBe("interne");
    expect(classifyReferrer("https://www.souqauto.example/", own)).toBe("interne");
    expect(classifyReferrer("http://localhost:5184/fr", "localhost:5184")).toBe("interne");
  });

  it("puts search engines, social networks and the rest in three categories, whatever the country domain", () => {
    for (const r of ["https://www.google.com/", "https://www.google.dz/search?q=x", "https://www.bing.com/", "https://duckduckgo.com/", "android-app://com.google.android.googlequicksearchbox"]) {
      expect(classifyReferrer(r, own), r).toBe("recherche");
    }
    for (const r of ["https://l.facebook.com/l.php?u=x", "https://m.facebook.com/", "https://www.instagram.com/", "https://t.co/abc", "https://x.com/", "https://wa.me/213555", "https://t.me/x"]) {
      expect(classifyReferrer(r, own), r).toBe("reseaux");
    }
    for (const r of ["https://www.ouedkniss.com/", "https://blog.exemple.dz/", "https://www.content.com/", "https://microsoft.com/"]) {
      expect(classifyReferrer(r, own), r).toBe("autre");
    }
  });

  it("does not let a look-alike domain pass for the site", () => {
    expect(classifyReferrer("https://souqauto.example.evil.com/", own)).toBe("autre");
    expect(classifyReferrer("https://notsouqauto.example/", own)).toBe("autre");
  });
});

describe("classifyDevice", () => {
  it("separates mobile, tablet and desktop", () => {
    expect(classifyDevice("Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36")).toBe("mobile");
    expect(classifyDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1")).toBe("mobile");
    expect(classifyDevice("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148")).toBe("tablette");
    expect(classifyDevice("Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36")).toBe("tablette"); // Android sans « Mobile »
    expect(classifyDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36")).toBe("ordinateur");
    expect(classifyDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15")).toBe("ordinateur");
  });

  it("falls back to desktop without a User-Agent", () => {
    expect(classifyDevice(null)).toBe("ordinateur");
    expect(classifyDevice(undefined)).toBe("ordinateur");
    expect(classifyDevice("")).toBe("ordinateur");
  });
});

describe("parseBeacon", () => {
  it("reads a path and an optional referrer", () => {
    expect(parseBeacon(JSON.stringify({ path: "/fr/recherche", referrer: "https://www.google.com/" }))).toEqual({ path: "/fr/recherche", referrer: "https://www.google.com/" });
    expect(parseBeacon(JSON.stringify({ path: "/fr" }))).toEqual({ path: "/fr" });
  });

  it("refuses anything else: empty, not JSON, oversized, wrong types", () => {
    for (const text of ["", "pas du json", "null", "[]", "42", JSON.stringify({}), JSON.stringify({ path: "" }), JSON.stringify({ path: 5 }), JSON.stringify({ path: "/fr", referrer: 5 }), JSON.stringify({ path: "/" + "a".repeat(400) })]) {
      expect(parseBeacon(text), text).toBeNull();
    }
    expect(parseBeacon(JSON.stringify({ path: "/fr", padding: "x".repeat(MAX_BEACON_BYTES) }))).toBeNull();
  });
});

describe("isTrackingOptOut", () => {
  const headers = (h: Record<string, string>) => ({ get: (name: string) => h[name.toLowerCase()] ?? null });
  it("honours Do Not Track and Global Privacy Control", () => {
    expect(isTrackingOptOut(headers({ dnt: "1" }))).toBe(true);
    expect(isTrackingOptOut(headers({ "sec-gpc": "1" }))).toBe(true);
  });
  it("counts everybody else", () => {
    expect(isTrackingOptOut(headers({}))).toBe(false);
    expect(isTrackingOptOut(headers({ dnt: "0" }))).toBe(false);
  });
});
