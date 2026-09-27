import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/site";
import { getListingStats, getBrandCountsForWilaya } from "@/lib/catalogue-stats";
import { buildBreadcrumbJsonLd, buildPlaceJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ListingCard } from "@/components/search/ListingCard";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { estimatePricesForListings } from "@/lib/price-estimation";
import { computePriceBadge } from "@/lib/price-badge";
import { getSellerTrustSummariesForSellers } from "@/lib/seller-trust";
import { getSellerResponsivenessCached } from "@/lib/seller-responsiveness-service";
import { cardSellerBadges } from "@/lib/seller-card-badges";
import { getProfessionalBadgesForSellers } from "@/lib/professional-accounts";

async function getWilaya(slug: string) {
  return prisma.wilaya.findUnique({ where: { slug } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; wilaya: string }>;
}): Promise<Metadata> {
  const { locale, wilaya: wilayaSlug } = await params;
  const wilaya = await getWilaya(wilayaSlug);
  if (!wilaya) return {};

  const t = await getTranslations({ locale, namespace: "Catalogue" });
  const wilayaLabel = locale === "ar" ? wilaya.nomAr : wilaya.nomFr;
  const title = t("wilayaTitle", { wilaya: wilayaLabel });
  const description = t("wilayaMetaDescription", { wilaya: wilayaLabel });
  const canonical = `${SITE_URL}/${locale}/wilaya/${wilaya.slug}`;

  return {
    title: `${title} — Souq Auto`,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
  };
}

export default async function WilayaPage({
  params,
}: {
  params: Promise<{ locale: string; wilaya: string }>;
}) {
  const { locale, wilaya: wilayaSlug } = await params;
  const wilaya = await getWilaya(wilayaSlug);
  if (!wilaya) notFound();

  const t = await getTranslations("Catalogue");
  const wilayaLabel = locale === "ar" ? wilaya.nomAr : wilaya.nomFr;

  const [stats, brandCounts, recentListings, currentUser] = await Promise.all([
    getListingStats({ wilayaId: wilaya.id }),
    getBrandCountsForWilaya(wilaya.id),
    prisma.listing.findMany({
      where: { wilayaId: wilaya.id, status: "PUBLIEE" },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        brand: true,
        model: true,
        wilaya: true,
        commune: true,
        photos: { orderBy: { position: "asc" }, take: 1 },
        equipments: { select: { equipmentId: true } },
      },
    }),
    getCurrentUser(),
  ]);

  const topBrands = await prisma.brand.findMany({
    where: { id: { in: Array.from(brandCounts.keys()) } },
    orderBy: { name: "asc" },
  });

  const favoriteIds = currentUser
    ? new Set(
        (
          await prisma.favorite.findMany({
            where: { userId: currentUser.id, listingId: { in: recentListings.map((l) => l.id) } },
            select: { listingId: true },
          })
        ).map((f) => f.listingId)
      )
    : new Set<string>();

  const estimates = await estimatePricesForListings(
    recentListings.map((l) => ({ ...l, equipmentIds: l.equipments.map((e) => e.equipmentId) }))
  );
  const priceBadges = new Map(
    recentListings.map((listing) => {
      const estimate = estimates.get(listing.id);
      return [listing.id, estimate ? computePriceBadge(listing.price, estimate.mid, estimate.sampleSize) : null];
    })
  );

  const [sellerTrustBySeller, responsivenessBySeller] = await Promise.all([
    getSellerTrustSummariesForSellers(recentListings.map((l) => l.sellerId)),
    getSellerResponsivenessCached(recentListings.map((l) => l.sellerId)),
  ]);
  const professionalBadgesBySeller = await getProfessionalBadgesForSellers(
    recentListings.map((l) => l.sellerId)
  );

  const wilayaUrl = `${SITE_URL}/${locale}/wilaya/${wilaya.slug}`;
  const breadcrumbItems = [{ name: t("breadcrumbHome"), href: "/" }, { name: wilayaLabel }];
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: wilayaLabel, url: wilayaUrl },
  ]);
  const placeJsonLd = buildPlaceJsonLd({
    name: wilayaLabel,
    url: wilayaUrl,
    containedInPlaceUrl: `${SITE_URL}/${locale}`,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(placeJsonLd) }} />

      <Breadcrumbs items={breadcrumbItems} />

      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("wilayaTitle", { wilaya: wilayaLabel })}</h1>

      {stats.count === 0 ? (
        <p className="mt-4 text-slate-500 dark:text-slate-400">{t("noStatsWilaya")}</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("statsCount", { count: stats.count })}</p>
            </div>
            {stats.avgPrice && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("avgPrice")}</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{stats.avgPrice.toLocaleString()} DA</p>
              </div>
            )}
            {stats.minPrice && stats.maxPrice && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("priceRange")}</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {stats.minPrice.toLocaleString()} – {stats.maxPrice.toLocaleString()} DA
                </p>
              </div>
            )}
          </div>

          {topBrands.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t("topBrandsTitle")}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {topBrands.map((brand) => {
                  const brandStat = brandCounts.get(brand.id);
                  if (!brandStat) return null;
                  return (
                    <Link
                      key={brand.id}
                      href={`/recherche?wilayaId=${wilaya.id}&brandId=${brand.id}`}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-slate-300 dark:hover:border-slate-600"
                    >
                      <p className="font-medium text-slate-900 dark:text-slate-100">{brand.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {t("statsCount", { count: brandStat.count })}
                      </p>
                      {brandStat.minPrice && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {t("fromPrice", { price: brandStat.minPrice.toLocaleString() })}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {recentListings.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t("recentListings")}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentListings.map((listing, index) => (
                  <ListingCard
                    eager={index < 3}
                    key={listing.id}
                    listing={listing}
                    isLoggedIn={Boolean(currentUser)}
                    isFavorited={favoriteIds.has(listing.id)}
                    priceBadge={priceBadges.get(listing.id)}
                    sellerTrustScore={sellerTrustBySeller.get(listing.sellerId)?.trustBreakdown.score}
                  sellerBadges={cardSellerBadges(sellerTrustBySeller.get(listing.sellerId), responsivenessBySeller.get(listing.sellerId))}
                    professionalBadge={professionalBadgesBySeller.get(listing.sellerId)}
                  />
                ))}
              </div>
            </div>
          )}

          <Link
            href={`/recherche?wilayaId=${wilaya.id}`}
            className="mt-8 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            {t("viewAllWilayaListings", { wilaya: wilayaLabel })}
          </Link>
        </>
      )}
    </div>
  );
}
