import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/site";
import { getListingStats, getModelCountsForBrand } from "@/lib/catalogue-stats";
import { buildBreadcrumbJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ListingCard } from "@/components/search/ListingCard";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { estimatePricesForListings } from "@/lib/price-estimation";
import { computePriceBadge } from "@/lib/price-badge";
import { getSellerTrustSummariesForSellers } from "@/lib/seller-trust";
import { getProfessionalBadgesForSellers } from "@/lib/professional-accounts";

async function getBrand(slug: string) {
  return prisma.brand.findUnique({
    where: { slug },
    include: { models: { orderBy: { name: "asc" } } },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; brand: string }>;
}): Promise<Metadata> {
  const { locale, brand: brandSlug } = await params;
  const brand = await getBrand(brandSlug);
  if (!brand) return {};

  const t = await getTranslations({ locale, namespace: "Catalogue" });
  const title = t("brandTitle", { brand: brand.name });
  const canonical = `${SITE_URL}/${locale}/voitures/${brand.slug}`;

  return {
    title: `${title} — Souq Auto`,
    description: title,
    alternates: { canonical },
    openGraph: { title, url: canonical, type: "website" },
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ locale: string; brand: string }>;
}) {
  const { locale, brand: brandSlug } = await params;
  const brand = await getBrand(brandSlug);
  if (!brand) notFound();

  const t = await getTranslations("Catalogue");

  const [stats, modelCounts, recentListings, currentUser] = await Promise.all([
    getListingStats({ brandId: brand.id }),
    getModelCountsForBrand(brand.id),
    prisma.listing.findMany({
      where: { brandId: brand.id, status: "PUBLIEE" },
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

  const sellerTrustBySeller = await getSellerTrustSummariesForSellers(
    recentListings.map((l) => l.sellerId)
  );
  const professionalBadgesBySeller = await getProfessionalBadgesForSellers(
    recentListings.map((l) => l.sellerId)
  );

  const breadcrumbItems = [
    { name: t("breadcrumbHome"), href: "/" },
    { name: brand.name },
  ];
  const jsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: brand.name, url: `${SITE_URL}/${locale}/voitures/${brand.slug}` },
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />

      <Breadcrumbs items={breadcrumbItems} />

      <h1 className="text-2xl font-semibold text-slate-900">{t("brandTitle", { brand: brand.name })}</h1>

      {stats.count === 0 ? (
        <p className="mt-4 text-slate-500">{t("noStatsBrand")}</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-xs text-slate-400">{t("statsCount", { count: stats.count })}</p>
            </div>
            {stats.avgPrice && (
              <div>
                <p className="text-xs text-slate-400">{t("avgPrice")}</p>
                <p className="font-medium text-slate-900">{stats.avgPrice.toLocaleString()} DA</p>
              </div>
            )}
            {stats.minPrice && stats.maxPrice && (
              <div>
                <p className="text-xs text-slate-400">{t("priceRange")}</p>
                <p className="font-medium text-slate-900">
                  {stats.minPrice.toLocaleString()} – {stats.maxPrice.toLocaleString()} DA
                </p>
              </div>
            )}
          </div>

          {brand.models.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-medium text-slate-700 mb-3">{t("modelsTitle")}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {brand.models.map((model) => {
                  const modelStat = modelCounts.get(model.id);
                  if (!modelStat) return null;
                  return (
                    <Link
                      key={model.id}
                      href={`/voitures/${brand.slug}/${model.slug}`}
                      className="rounded-lg border border-slate-200 p-3 hover:border-slate-300"
                    >
                      <p className="font-medium text-slate-900">{model.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {t("statsCount", { count: modelStat.count })}
                      </p>
                      {modelStat.minPrice && (
                        <p className="text-xs text-slate-500 mt-1">
                          {t("fromPrice", { price: modelStat.minPrice.toLocaleString() })}
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
              <h2 className="text-sm font-medium text-slate-700 mb-3">{t("recentListings")}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    isLoggedIn={Boolean(currentUser)}
                    isFavorited={favoriteIds.has(listing.id)}
                    priceBadge={priceBadges.get(listing.id)}
                    sellerTrustScore={sellerTrustBySeller.get(listing.sellerId)?.trustBreakdown.score}
                    professionalBadge={professionalBadgesBySeller.get(listing.sellerId)}
                  />
                ))}
              </div>
            </div>
          )}

          <Link
            href={`/recherche?brandId=${brand.id}`}
            className="mt-8 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {t("viewAllListings", { brand: brand.name })}
          </Link>
        </>
      )}
    </div>
  );
}
