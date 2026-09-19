import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

// Le service worker est un fichier public ordinaire (public/sw.js) : on en importe la fonction
// de décision, la seule logique qui compte pour la vie privée des visiteurs.
const require = createRequire(import.meta.url);
const sw = require("../public/sw.js") as {
  classifyRequest: (request: unknown, origin: string) => "ignore" | "navigate" | "static";
  STATIC_CACHE: string;
  OFFLINE_URL: string;
  PRECACHE: string[];
};

const ORIGIN = "https://souqauto.example";

function req({
  method = "GET",
  mode = "no-cors",
  url,
  headers = {},
}: {
  method?: string;
  mode?: string;
  url: string;
  headers?: Record<string, string>;
}) {
  return { method, mode, url, headers: { get: (name: string) => headers[name.toLowerCase()] ?? null } };
}

describe("service worker — classifyRequest", () => {
  it("serves a page navigation from the network, with the offline page as the only fallback", () => {
    expect(sw.classifyRequest(req({ mode: "navigate", url: `${ORIGIN}/fr/recherche?q=clio` }), ORIGIN)).toBe("navigate");
    expect(sw.classifyRequest(req({ mode: "navigate", url: `${ORIGIN}/fr/compte/messages` }), ORIGIN)).toBe("navigate");
  });

  it("caches only immutable static files: build assets and icons", () => {
    expect(sw.classifyRequest(req({ url: `${ORIGIN}/_next/static/chunks/app-1a2b3c.js` }), ORIGIN)).toBe("static");
    expect(sw.classifyRequest(req({ url: `${ORIGIN}/_next/static/css/abcd.css` }), ORIGIN)).toBe("static");
    expect(sw.classifyRequest(req({ url: `${ORIGIN}/icons/icon-192.png` }), ORIGIN)).toBe("static");
  });

  it("never touches the API, whatever the request looks like", () => {
    for (const path of ["/api/auth/me", "/api/listings/abc/contact", "/api/profile/export", "/api/health"]) {
      expect(sw.classifyRequest(req({ url: `${ORIGIN}${path}` }), ORIGIN), path).toBe("ignore");
      expect(sw.classifyRequest(req({ mode: "navigate", url: `${ORIGIN}${path}` }), ORIGIN), path).toBe("ignore");
    }
  });

  it("never touches Next's own page-to-page requests (RSC data, prefetches): they are personalised", () => {
    const internalHeaders: Record<string, string>[] = [
      { rsc: "1" },
      { "next-router-prefetch": "1" },
      { "next-router-state-tree": "%5B%22%22" },
      { "next-url": "/fr/compte" },
    ];
    for (const headers of internalHeaders) {
      expect(sw.classifyRequest(req({ url: `${ORIGIN}/fr/compte/favoris?_rsc=abc`, headers }), ORIGIN)).toBe("ignore");
      expect(sw.classifyRequest(req({ mode: "navigate", url: `${ORIGIN}/fr/compte/favoris`, headers }), ORIGIN)).toBe("ignore");
    }
  });

  it("only handles GET", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(sw.classifyRequest(req({ method, mode: "navigate", url: `${ORIGIN}/fr` }), ORIGIN), method).toBe("ignore");
      expect(sw.classifyRequest(req({ method, url: `${ORIGIN}/_next/static/x.js` }), ORIGIN), method).toBe("ignore");
    }
  });

  it("ignores every other origin (photos on S3, analytics, wa.me…)", () => {
    expect(sw.classifyRequest(req({ url: "https://cdn.example.org/_next/static/x.js" }), ORIGIN)).toBe("ignore");
    expect(sw.classifyRequest(req({ mode: "navigate", url: "https://wa.me/213555123456" }), ORIGIN)).toBe("ignore");
  });

  it("does not cache uploaded photos, documents or any other path", () => {
    for (const path of ["/uploads/listings/a.jpg", "/uploads/avatars/b.jpg", "/fr/annonce/abc", "/sitemap.xml", "/manifest.webmanifest", "/sw.js", "/offline.html"]) {
      expect(sw.classifyRequest(req({ url: `${ORIGIN}${path}` }), ORIGIN), path).toBe("ignore");
    }
  });

  it("ignores a malformed URL instead of throwing", () => {
    expect(sw.classifyRequest(req({ url: "pas une adresse" }), ORIGIN)).toBe("ignore");
  });

  it("precaches exactly the offline page and the two main icons, in a versioned cache", () => {
    expect(sw.OFFLINE_URL).toBe("/offline.html");
    expect(sw.PRECACHE).toEqual(["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"]);
    expect(sw.STATIC_CACHE).toMatch(/^souq-static-v\d+$/);
  });
});
