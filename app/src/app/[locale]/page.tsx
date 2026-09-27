import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { SITE_URL } from "@/lib/site";
import { buildWebSiteJsonLd, buildOrganizationJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { getSearchBrands, getSearchWilayas } from "@/lib/reference-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });
  const canonical = `${SITE_URL}/${locale}`;
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical },
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: canonical, type: "website" },
  };
}
import { SearchFilters } from "@/components/search/SearchFilters";
import { ListingCard } from "@/components/search/ListingCard";
import { RecentlyViewedSection } from "@/components/RecentlyViewedSection";

// Annonces en vedette (Lot 66) : seule la formule PREMIUM_PLUS obtient une
// mise en avant sur la page d'accueil, cf. docs/ARCHITECTURE.md §11
// (« Premium+ : mise en avant homepage + top de liste »), distincte de
// PREMIUM qui n'est boosté que dans les résultats de recherche.
const FEATURED_LIMIT = 4;
const RECENT_LIMIT = 6;

// Lot 211 — liens rapides carrosserie (les plus cherchées en Algérie)
const BODY_TYPE_LINKS = [
  { key: "SUV" as const, labelKey: "carrosserieSuv" },
  { key: "BERLINE" as const, labelKey: "carrosserieBerline" },
  { key: "CITADINE" as const, labelKey: "carrosserieCitadine" },
  { key: "BREAK" as const, labelKey: "carrosserieBreak" },
  { key: "PICKUP" as const, labelKey: "carrosseriePickup" },
  { key: "MONOSPACE" as const, labelKey: "carrosserieMonospace" },
] as const;

export default async function HomePage() {
  const t = await getTranslations("Home");

  // Lot 210 — brands/wilayas chargés en parallèle via le cache référentiel (5 min TTL)
  const [currentUser, featuredListings, brands, wilayas, recentListings] = await Promise.all([
    getCurrentUser(),
    prisma.listing.findMany({
      where: { status: "PUBLIEE", formula: "PREMIUM_PLUS" },
      orderBy: { publishedAt: "desc" },
      take: FEATURED_LIMIT,
      include: {
        brand: true,
        model: true,
        wilaya: true,
        commune: true,
        photos: { orderBy: { position: "asc" }, take: 1 },
      },
    }),
    getSearchBrands(),
    getSearchWilayas(),
    // Lot 211 — annonces récentes (hors PREMIUM_PLUS déjà affichées)
    prisma.listing.findMany({
      where: { status: "PUBLIEE", formula: { not: "PREMIUM_PLUS" } },
      orderBy: { publishedAt: "desc" },
      take: RECENT_LIMIT,
      include: {
        brand: true,
        model: true,
        wilaya: true,
        commune: true,
        photos: { orderBy: { position: "asc" }, take: 1 },
      },
    }),
  ]);

  const allListingIds = [...featuredListings.map((l) => l.id), ...recentListings.map((l) => l.id)];
  const favoriteIds = currentUser
    ? new Set(
        (
          await prisma.favorite.findMany({
            where: { userId: currentUser.id, listingId: { in: allListingIds } },
            select: { listingId: true },
          })
        ).map((f) => f.listingId)
      )
    : new Set<string>();

  const webSiteJsonLd = buildWebSiteJsonLd({
    siteUrl: SITE_URL,
    siteName: "Souq Auto",
    searchUrlTemplate: `${SITE_URL}/fr/recherche?q={search_term_string}`,
  });
  const orgJsonLd = buildOrganizationJsonLd({
    siteUrl: SITE_URL,
    siteName: "Souq Auto",
    logoUrl: `${SITE_URL}/icons/icon-512.png`,
  });

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(webSiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(orgJsonLd) }} />
      {/* Hero — bande colorée pleine largeur */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold text-white text-balance">
            {t("heroTitle")}
          </h1>
          <p className="mt-3 text-slate-300">{t("heroSubtitle")}</p>

          {/* Lot 210 — brands/wilayas réels passés à la barre de recherche */}
          <div className="mt-8 bg-white dark:bg-slate-800 rounded-xl p-3 shadow-lg dark:shadow-slate-900/50">
            <SearchFilters brands={brands} wilayas={wilayas} initialValues={{}} compact />
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/vendre"
              className="rounded-md border border-white/30 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/15"
            >
              {t("sellButton")}
            </Link>
            <Link
              href="/cote-souq-auto"
              className="rounded-md border border-white/30 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/15"
            >
              {t("estimateButton")}
            </Link>
            <Link
              href="/voitures"
              className="rounded-md border border-white/30 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/15"
            >
              {t("browseBrandsButton")}
            </Link>
          </div>
        </div>
      </div>

      {/* Lot 211 — liens rapides carrosserie */}
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-2">
        <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          {t("carrosserieTitle")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {BODY_TYPE_LINKS.map(({ key, labelKey }) => (
            <Link
              key={key}
              href={`/recherche?bodyType=${key}`}
              className="rounded-full border border-slate-200 dark:border-slate-700 px-4 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-700 dark:hover:border-emerald-400 dark:hover:text-emerald-400"
            >
              {t(labelKey)}
            </Link>
          ))}
        </div>
      </div>

      {featuredListings.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t("featuredTitle")}</h2>
            <Link href="/recherche" className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline">
              {t("seeAllListings")}
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredListings.map((listing, index) => (
              <ListingCard
                eager={index < 4}
                key={listing.id}
                listing={listing}
                isLoggedIn={Boolean(currentUser)}
                isFavorited={favoriteIds.has(listing.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Lot 211 — annonces récentes (toutes formulas sauf PREMIUM_PLUS) */}
      {recentListings.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t("recentListingsTitle")}</h2>
            <Link href="/recherche?sort=newest" className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline">
              {t("seeAllListings")}
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentListings.map((listing, index) => (
              <ListingCard
                eager={index < 3}
                key={listing.id}
                listing={listing}
                isLoggedIn={Boolean(currentUser)}
                isFavorited={favoriteIds.has(listing.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Lot 151 — annonces récemment vues, lues côté client depuis localStorage */}
      <div className="mx-auto max-w-6xl px-4 pb-12">
        <RecentlyViewedSection />
      </div>
    </div>
  );
}
