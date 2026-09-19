import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Chemins que les moteurs de recherche ne doivent pas explorer : espaces personnels, publication,
// administration, outils du compte professionnel, pages de connexion et de confirmation.
//
// Toutes les adresses du site commencent par la langue (/fr/compte/…, /ar/compte/…) : une règle
// « /compte/ » seule ne bloquerait rien. Le « * » (joker géré par Google et Bing) couvre les deux
// langues. Lot 124 : ces règles étaient auparavant écrites sans le préfixe de langue, donc sans effet.
export const ROBOTS_DISALLOW = [
  "/api/",
  "/*/compte",
  "/*/publier",
  "/*/admin",
  "/*/pro/tableau-de-bord",
  "/*/pro/import",
  "/*/pro/statistiques",
  "/*/pro/prospects",
  "/*/connexion",
  "/*/inscription",
  "/*/verifier-email",
  "/*/confirmer-email",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ROBOTS_DISALLOW,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
