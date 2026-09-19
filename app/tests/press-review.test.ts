import { describe, expect, it } from "vitest";
import { hostLabel, normalizeSourceUrl } from "@/lib/press-review";
import { pressReviewSchema } from "@/lib/validation/press-review";
import { generateUniqueSlug, RESERVED_SLUGS } from "@/lib/blog";

describe("normalizeSourceUrl", () => {
  it("accepts a normal https article address", () => {
    expect(normalizeSourceUrl("https://media.example.fr/essais/renault-clio-2026")).toBe(
      "https://media.example.fr/essais/renault-clio-2026"
    );
  });

  it("refuses every scheme other than https, notably script and data addresses", () => {
    for (const raw of [
      "http://media.example.fr/essai",
      "javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "ftp://media.example.fr/essai",
      "//media.example.fr/essai",
      "media.example.fr/essai",
      "vbscript:msgbox",
    ]) {
      expect(normalizeSourceUrl(raw)).toBeNull();
    }
  });

  it("refuses credentials in the address, which hide the real destination", () => {
    expect(normalizeSourceUrl("https://media.example.fr@evil.example.com/essai")).toBeNull();
    expect(normalizeSourceUrl("https://user:pass@media.example.fr/essai")).toBeNull();
  });

  it("refuses IP addresses, internal names and empty or oversized values", () => {
    for (const raw of ["https://127.0.0.1/essai", "https://192.168.1.10/x", "https://[::1]/x", "https://localhost/x", "https://intranet/x", "", "   "]) {
      expect(normalizeSourceUrl(raw)).toBeNull();
    }
    expect(normalizeSourceUrl(`https://media.example.fr/${"a".repeat(600)}`)).toBeNull();
  });

  it("drops the fragment, tracking parameters and the trailing slash so the same article is recognised", () => {
    const a = normalizeSourceUrl("https://Media.Example.fr/essai/clio/?utm_source=fb&utm_campaign=x&fbclid=abc#commentaires");
    const b = normalizeSourceUrl("https://media.example.fr/essai/clio");
    expect(a).toBe("https://media.example.fr/essai/clio");
    expect(a).toBe(b);
  });

  it("keeps the query parameters that identify the page", () => {
    expect(normalizeSourceUrl("https://media.example.fr/article?id=42&utm_medium=x")).toBe(
      "https://media.example.fr/article?id=42"
    );
  });

  it("trims surrounding spaces", () => {
    expect(normalizeSourceUrl("  https://media.example.fr/essai  ")).toBe("https://media.example.fr/essai");
  });
});

describe("hostLabel", () => {
  it("shows the domain without www", () => {
    expect(hostLabel("https://www.media.example.fr/essai")).toBe("media.example.fr");
  });
});

describe("pressReviewSchema", () => {
  const valid = {
    sourceName: "Média de test",
    url: "https://media.example.fr/essai-clio",
    title: "Titre de l'article de test",
    noteFr: "Un essai de la citadine qui détaille son comportement sur route.",
    noteAr: "تجربة للسيارة الحضرية تفصّل سلوكها على الطريق بوضوح.",
  };

  it("accepts a complete entry and normalises the address", () => {
    const parsed = pressReviewSchema.parse({ ...valid, url: "https://media.example.fr/essai-clio/?utm_source=x#top" });
    expect(parsed.url).toBe("https://media.example.fr/essai-clio");
    expect(parsed.published).toBe(false);
  });

  it("rejects an unsafe address", () => {
    expect(pressReviewSchema.safeParse({ ...valid, url: "javascript:alert(1)" }).success).toBe(false);
    expect(pressReviewSchema.safeParse({ ...valid, url: "http://media.example.fr/x" }).success).toBe(false);
  });

  it("requires the editorial sentence in both languages, and keeps it short enough not to carry an excerpt", () => {
    expect(pressReviewSchema.safeParse({ ...valid, noteFr: "Trop court" }).success).toBe(false);
    expect(pressReviewSchema.safeParse({ ...valid, noteAr: "" }).success).toBe(false);
    expect(pressReviewSchema.safeParse({ ...valid, noteFr: "x".repeat(301) }).success).toBe(false);
    expect(pressReviewSchema.safeParse({ ...valid, noteFr: "x".repeat(300) }).success).toBe(true);
  });

  it("limits the title, and refuses a source date in the future", () => {
    expect(pressReviewSchema.safeParse({ ...valid, title: "x".repeat(201) }).success).toBe(false);
    expect(pressReviewSchema.safeParse({ ...valid, sourcePublishedAt: "2099-01-01" }).success).toBe(false);
    expect(pressReviewSchema.safeParse({ ...valid, sourcePublishedAt: "2026-09-01" }).success).toBe(true);
  });

  it("caps catalogue ids at the 32-bit range", () => {
    expect(pressReviewSchema.safeParse({ ...valid, modelId: 2_147_483_648 }).success).toBe(false);
  });
});

describe("reserved slugs", () => {
  it("never gives an article the slug of the fixed press-review page", () => {
    expect(RESERVED_SLUGS).toContain("revue-de-presse");
    expect(generateUniqueSlug("revue-de-presse", ["autre", ...RESERVED_SLUGS])).toBe("revue-de-presse-2");
  });
});
