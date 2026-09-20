import { describe, expect, it } from "vitest";
import { SITEMAP_MAX_URLS, SITEMAP_SAFETY_MARGIN, listingBudget, sitemapTruncationWarning } from "@/lib/sitemap-limits";

describe("limite du plan du site (50 000 adresses)", () => {
  it("laisse aux annonces tout ce que les autres pages ne prennent pas, moins une marge", () => {
    expect(listingBudget(0)).toBe(SITEMAP_MAX_URLS - SITEMAP_SAFETY_MARGIN);
    expect(listingBudget(700)).toBe(SITEMAP_MAX_URLS - SITEMAP_SAFETY_MARGIN - 700);
  });
  it("ne devient jamais négatif, même si les autres pages débordent déjà", () => {
    expect(listingBudget(SITEMAP_MAX_URLS + 10)).toBe(0);
  });
  it("le total reste sous la limite du protocole, marge comprise", () => {
    const other = 1_200;
    expect(other + listingBudget(other)).toBeLessThan(SITEMAP_MAX_URLS);
  });
  it("n'avertit pas tant que tout tient, avertit avec les deux nombres quand ça déborde", () => {
    expect(sitemapTruncationWarning(16_000, 48_000)).toBeNull();
    expect(sitemapTruncationWarning(48_000, 48_000)).toBeNull();
    const warning = sitemapTruncationWarning(60_000, 48_000)!;
    expect(warning).toContain("60000");
    expect(warning).toContain("48000");
    expect(warning).toContain("plus récentes");
  });
});
