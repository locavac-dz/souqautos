import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { routing } from "@/i18n/routing";

function localizedEntry(path: string, lastModified?: Date) {
  const [defaultLocale] = routing.locales;
  return {
    url: `${SITE_URL}/${defaultLocale}${path}`,
    lastModified,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale) => [locale, `${SITE_URL}/${locale}${path}`])
      ),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [brands, listings] = await Promise.all([
    prisma.brand.findMany({ include: { models: true } }),
    prisma.listing.findMany({
      where: { status: "PUBLIEE" },
      select: { id: true, createdAt: true },
    }),
  ]);

  const staticEntries = [
    localizedEntry(""),
    localizedEntry("/recherche"),
    localizedEntry("/cote-souq-auto"),
    localizedEntry("/voitures"),
  ];

  const brandEntries = brands.map((brand) => localizedEntry(`/voitures/${brand.slug}`));

  const modelEntries = brands.flatMap((brand) =>
    brand.models.map((model) => localizedEntry(`/voitures/${brand.slug}/${model.slug}`))
  );

  const listingEntries = listings.map((listing) =>
    localizedEntry(`/annonce/${listing.id}`, listing.createdAt)
  );

  return [...staticEntries, ...brandEntries, ...modelEntries, ...listingEntries];
}
