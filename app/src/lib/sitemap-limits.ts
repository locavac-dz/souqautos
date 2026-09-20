// Lot 137 — limite du protocole des plans de site : 50 000 adresses (et 50 Mo) par fichier. Au-delà, Google et Bing rejettent
// le plan ENTIER, et plus aucune annonce n'est découverte par ce canal. Mesuré : 16 000 annonces = 4,9 Mo, 0,5 s.
//
// Tant que le site reste sous la limite, rien ne change. Au-delà, les annonces les PLUS RÉCENTES restent (ce sont elles que les
// moteurs de recherche ont le plus intérêt à découvrir) et un avertissement est écrit dans les journaux : c'est le signal
// qu'il faut passer à plusieurs plans (generateSitemaps de Next.js, avec un plan d'index déclaré dans robots.txt).
export const SITEMAP_MAX_URLS = 50_000;
// Marge : les pages statiques et éditoriales s'ajoutent entre-temps sans que personne ne pense à ce plafond.
export const SITEMAP_SAFETY_MARGIN = 500;

export function listingBudget(otherUrlCount: number): number {
  return Math.max(0, SITEMAP_MAX_URLS - SITEMAP_SAFETY_MARGIN - otherUrlCount);
}

export function sitemapTruncationWarning(publishedCount: number, budget: number): string | null {
  if (publishedCount <= budget) return null;
  return `[sitemap] ${publishedCount} annonces publiées mais le plan du site est limité à ${SITEMAP_MAX_URLS} adresses : seules les ${budget} plus récentes y figurent. Passer à plusieurs plans (docs/EXPLOITATION.md).`;
}
