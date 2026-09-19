import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { routing } from "@/i18n/routing";
import { getDirectoryEntries } from "@/lib/professional-directory";
import { publishedNow } from "@/lib/blog-publication";

// Lot 110 — sans cette ligne Next fige le sitemap au moment du build (rien ne
// lui indique que la base est lue) : un essai programmé n'y apparaîtrait jamais
// une fois sa date atteinte, et une nouvelle annonce non plus.
export const dynamic = "force-dynamic";

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
  const [brands, wilayas, listings, articles, proShowcases] = await Promise.all([
    prisma.brand.findMany({ include: { models: true } }),
    prisma.wilaya.findMany(),
    prisma.listing.findMany({
      where: { status: "PUBLIEE" },
      select: { id: true, createdAt: true },
    }),
    prisma.blogArticle.findMany({
      where: publishedNow(new Date()),
      select: { slug: true, kind: true, updatedAt: true },
    }),
    // Seules les vitrines indexables (au moins une annonce publiée, cf.
    // isShowcaseIndexable) : exactement celles de l'annuaire.
    getDirectoryEntries(),
  ]);

  const staticEntries = [
    localizedEntry(""),
    localizedEntry("/recherche"),
    localizedEntry("/cote-souq-auto"),
    localizedEntry("/voitures"),
    localizedEntry("/wilaya"),
    localizedEntry("/mag"),
    localizedEntry("/professionnels"),
    localizedEntry("/concessionnaires"),
    localizedEntry("/essais"),
  ];

  const brandEntries = brands.map((brand) => localizedEntry(`/voitures/${brand.slug}`));

  const modelEntries = brands.flatMap((brand) =>
    brand.models.map((model) => localizedEntry(`/voitures/${brand.slug}/${model.slug}`))
  );

  const wilayaEntries = wilayas.map((wilaya) => localizedEntry(`/wilaya/${wilaya.slug}`));

  const listingEntries = listings.map((listing) =>
    localizedEntry(`/annonce/${listing.id}`, listing.createdAt)
  );

  const articleEntries = articles.map((article) =>
    localizedEntry(`${article.kind === "ESSAI" ? "/essais" : "/mag"}/${article.slug}`, article.updatedAt)
  );

  const proShowcaseEntries = proShowcases.map((entry) => localizedEntry(`/pro/${entry.id}`));

  return [
    ...staticEntries,
    ...proShowcaseEntries,
    ...brandEntries,
    ...modelEntries,
    ...wilayaEntries,
    ...listingEntries,
    ...articleEntries,
  ];
}
