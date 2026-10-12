import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

// Lot 121 — les deux fonctions de validation du service worker (public/sw.js) : ce qu'il affiche et
// ce qu'il ouvre au clic. Importées du vrai fichier, comme pour tests/pwa-sw.test.ts.
const require = createRequire(import.meta.url);
const sw = require("../public/sw.js") as {
  parsePushPayload: (text: string) => { title: string; body: string; url: string; tag: string; lang: "fr" | "ar" };
  safeTargetUrl: (url: unknown, origin: string) => string;
};

const ORIGIN = "https://souqauto.example";

describe("service worker — parsePushPayload", () => {
  it("reads a well-formed message", () => {
    expect(sw.parsePushPayload(JSON.stringify({ title: "Nouvelle annonce", body: "Clio — 1 500 000 DA", url: "/fr/annonce/abc", tag: "alert-1", lang: "fr" }))).toEqual({
      title: "Nouvelle annonce",
      body: "Clio — 1 500 000 DA",
      url: "/fr/annonce/abc",
      tag: "alert-1",
      lang: "fr",
    });
  });

  it("marks an Arabic message so it is shown right-to-left", () => {
    expect(sw.parsePushPayload(JSON.stringify({ title: "إعلان جديد", lang: "ar" })).lang).toBe("ar");
  });

  it("never produces an empty notification: defaults for a missing title or a message that is not JSON", () => {
    expect(sw.parsePushPayload("").title).toBe("Souq Autos");
    expect(sw.parsePushPayload("pas du json").title).toBe("Souq Autos");
    expect(sw.parsePushPayload("null").title).toBe("Souq Autos");
    expect(sw.parsePushPayload("42").title).toBe("Souq Autos");
    expect(sw.parsePushPayload(JSON.stringify({ title: "" })).title).toBe("Souq Autos");
    expect(sw.parsePushPayload("{}")).toEqual({ title: "Souq Autos", body: "", url: "/", tag: "souq-auto", lang: "fr" });
  });

  it("ignores fields of the wrong type instead of showing « [object Object] »", () => {
    const payload = sw.parsePushPayload(JSON.stringify({ title: { a: 1 }, body: 12, url: ["/x"], tag: null, lang: "en" }));
    expect(payload).toEqual({ title: "Souq Autos", body: "", url: "/", tag: "souq-auto", lang: "fr" });
  });

  it("bounds the length of what it shows", () => {
    const payload = sw.parsePushPayload(JSON.stringify({ title: "T".repeat(1000), body: "B".repeat(1000), tag: "x".repeat(1000) }));
    expect(payload.title).toHaveLength(120);
    expect(payload.body).toHaveLength(200);
    expect(payload.tag).toHaveLength(80);
  });
});

describe("service worker — safeTargetUrl", () => {
  it("keeps a page of the site, with its query and anchor", () => {
    expect(sw.safeTargetUrl("/fr/annonce/abc", ORIGIN)).toBe("/fr/annonce/abc");
    expect(sw.safeTargetUrl("/fr/recherche?q=clio&page=2#resultats", ORIGIN)).toBe("/fr/recherche?q=clio&page=2#resultats");
    expect(sw.safeTargetUrl(`${ORIGIN}/ar/compte/alertes`, ORIGIN)).toBe("/ar/compte/alertes");
  });

  it("falls back to the home page for another site, whatever the disguise", () => {
    for (const url of [
      "https://evil.example/fr/annonce/abc",
      "//evil.example/x",
      "http://souqauto.example/x", // même nom, autre schéma = autre origine
      "https://souqauto.example.evil.example/x",
      "https://souqauto.example@evil.example/x",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
    ]) {
      expect(sw.safeTargetUrl(url, ORIGIN), url).toBe("/");
    }
  });

  it("falls back to the home page for anything that is not a string", () => {
    for (const value of [undefined, null, 42, {}, ["/x"]]) {
      expect(sw.safeTargetUrl(value, ORIGIN)).toBe("/");
    }
  });
});
