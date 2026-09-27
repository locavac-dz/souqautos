import { describe, expect, it } from "vitest";
import { localizedAlternates } from "@/lib/seo-alternates";
import { SITE_URL } from "@/lib/site";

describe("localizedAlternates — hreflang déduit de l'adresse canonique (Lot 231)", () => {
  it("donne la version de chaque langue, x-default sur le français, pour une page avec chemin", () => {
    expect(localizedAlternates(`${SITE_URL}/ar/voitures/renault`)).toEqual({
      canonical: `${SITE_URL}/ar/voitures/renault`,
      languages: { fr: `${SITE_URL}/fr/voitures/renault`, ar: `${SITE_URL}/ar/voitures/renault`, "x-default": `${SITE_URL}/fr/voitures/renault` },
    });
  });

  it("gère l'accueil (rien après la langue) et conserve les paramètres de requête (pagination)", () => {
    expect(localizedAlternates(`${SITE_URL}/fr`).languages).toEqual({ fr: `${SITE_URL}/fr`, ar: `${SITE_URL}/ar`, "x-default": `${SITE_URL}/fr` });
    expect(localizedAlternates(`${SITE_URL}/fr/essais?page=2`).languages).toMatchObject({ ar: `${SITE_URL}/ar/essais?page=2` });
    expect(localizedAlternates(`${SITE_URL}/ar?ref=x`).languages).toMatchObject({ fr: `${SITE_URL}/fr?ref=x` });
  });

  it("laisse la seule canonique à une adresse hors schéma (autre site, pas de langue)", () => {
    expect(localizedAlternates("https://ailleurs.example/page")).toEqual({ canonical: "https://ailleurs.example/page" });
    expect(localizedAlternates(`${SITE_URL}/en/voitures`)).toEqual({ canonical: `${SITE_URL}/en/voitures` });
    expect(localizedAlternates(`${SITE_URL}/sitemap.xml`)).toEqual({ canonical: `${SITE_URL}/sitemap.xml` });
  });
});
