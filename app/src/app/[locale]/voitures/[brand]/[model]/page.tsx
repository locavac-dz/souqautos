import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/site";
import { getListingStats } from "@/lib/catalogue-stats";
import { buildBreadcrumbJsonLd } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ListingCard } from "@/components/search/ListingCard";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { estimateFromRows } from "@/lib/price-estimation";
import { computePriceBadge } from "@/lib/price-badge";
import { getSellerTrustSummariesForSellers } from "@/lib/seller-trust";
import { getProfessionalBadgesForSellers } from "@/lib/professional-accounts";

async function getBrandAndModel(brandSlug: string, modelSlug: string) {
  const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
  if (!brand) return null;
  const model = await prisma.model.findUnique({
    where: { brandId_slug: { brandId: brand.id, slug: modelSlug } },
  });
  if (!model) return null;
  return { brand, model };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; brand: string; model: string }>;
}): Promise<Metadata> {
  const { locale, brand: brandSlug, model: modelSlug } = await params;
  const found = await getBrandAndModel(brandSlug, modelSlug);
  if (!found) return {};

  const t = await getTranslations({ locale, namespace: "Catalogue" });
  const title = t("modelTitle", { brand: found.brand.name, model: found.model.name });
  const canonical = `${SITE_URL}/${locale}/voitures/${found.brand.slug}/${found.model.slug}`;

  return {
    title: `${title} — Souq Auto`,
    description: title,
    alternates: { canonical },
    openGraph: { title, url: canonical, type: "website" },
  };
}

export default async function ModelPage({
  params,
}: {
  params: Promise<{ locale: string; brand: string; model: string }>;
}) {
  const { locale, brand: brandSlug, model: modelSlug } = await params;
  const found = await getBrandAndModel(brandSlug, modelSlug);
  if (!found) notFound();
  const { brand, model } = found;

  const t = await getTranslations("Catalogue");

  const [stats, listings, currentUser] = await Promise.all([
    getListingStats({ brandId: brand.id, modelId: model.id }),
    prisma.listing.findMany({
      where: { brandId: brand.id, modelId: model.id, status: "PUBLIEE" },
      orderBy: { createdAt: "desc" },
      take: 24,
      include: {
        brand: true,
        model: true,
        wilaya: true,
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
            where: { userId: currentUser.id, listingId: { in: listings.map((l) => l.id) } },
            select: { listingId: true },
          })
        ).map((f) => f.listingId)
      )
    : new Set<string>();

  // Tous les listings de cette page partagent déjà la même marque/modèle : on
  // réutilise ce jeu de lignes déjà chargé comme pool de comparables au lieu
  // de le requêter une seconde fois (cf. estimateFromRows, lib/price-estimation.ts).
  const comparableRows = listings.map((l) => ({ ...l, equipmentIds: l.equipments.map((e) => e.equipmentId) }));
  const priceBadges = new Map(
    listings.map((listing) => {
      const estimate = estimateFromRows(comparableRows, {
        year: listing.year,
        mileage: listing.mileage,
        wilayaId: listing.wilayaId,
        equipmentIds: listing.equipments.map((e) => e.equipmentId),
        excludeListingId: listing.id,
      });
      return [listing.id, estimate ? computePriceBadge(listing.price, estimate.mid, estimate.sampleSize) : null];
    })
  );

  const sellerTrustBySeller = await getSellerTrustSummariesForSellers(listings.map((l) => l.sellerId));
  const professionalBadgesBySeller = await getProfessionalBadgesForSellers(listings.map((l) => l.sellerId));

  const breadcrumbItems = [
    { name: t("breadcrumbHome"), href: "/" },
    { name: brand.name, href: `/voitures/${brand.slug}` },
    { name: model.name },
  ];
  const jsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: brand.name, url: `${SITE_URL}/${locale}/voitures/${brand.slug}` },
    { name: model.name, url: `${SITE_URL}/${locale}/voitures/${brand.slug}/${model.slug}` },
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs items={breadcrumbItems} />

      <h1 className="text-2xl font-semibold text-slate-900">
        {t("modelTitle", { brand: brand.name, model: model.name })}
      </h1>

      {stats.count === 0 ? (
        <p className="mt-4 text-slate-500">{t("noStatsModel")}</p>
      ) : (
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
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/cote-souq-auto?brandId=${brand.id}&modelId=${model.id}`}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-slate-400"
        >
          {t("estimateLink", { brand: brand.name, model: model.name })}
        </Link>
      </div>

      {listings.length > 0 && (
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => (
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
      )}

      {stats.count > 0 && (
        <Link
          href={`/recherche?brandId=${brand.id}&modelId=${model.id}`}
          className="mt-8 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {t("viewAllModelListings", { brand: brand.name, model: model.name })}
        </Link>
      )}
    </div>
  );
}
