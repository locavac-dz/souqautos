import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";

// Lot 231 — `alternates` d'une page publique : son adresse canonique ET ses versions dans chaque langue (balises
// <link rel="alternate" hreflang>), déduites de la canonique elle-même. Le plan du site les déclarait déjà (src/app/sitemap.ts) ;
// les pages, elles, ne donnaient que la canonique, si bien que Google pouvait tenir la version arabe pour un doublon de la française.
// `x-default` : la langue par défaut du site. Une adresse hors du schéma `${SITE_URL}/${locale}…` garde sa seule canonique.
export function localizedAlternates(canonical: string): { canonical: string; languages?: Record<string, string> } {
  const prefix = `${SITE_URL}/`;
  if (!canonical.startsWith(prefix)) return { canonical };
  const rest = canonical.slice(prefix.length);
  const slash = rest.indexOf("/");
  const query = rest.indexOf("?");
  const cut = [slash, query].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  const locale = cut === undefined ? rest : rest.slice(0, cut);
  const path = cut === undefined ? "" : rest.slice(cut);
  if (!(routing.locales as readonly string[]).includes(locale)) return { canonical };

  const languages = Object.fromEntries(routing.locales.map((l) => [l, `${SITE_URL}/${l}${path}`]));
  languages["x-default"] = `${SITE_URL}/${routing.defaultLocale}${path}`;
  return { canonical, languages };
}
