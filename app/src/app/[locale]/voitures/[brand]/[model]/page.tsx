import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/site";
import { localizedAlternates } from "@/lib/seo-alternates";
import { getListingStats, getModelPriceHistory } from "@/lib/catalogue-stats";
import { buildBreadcrumbJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RoadTestCard } from "@/components/RoadTestCard";
import { GuideCard, guideCardSelect } from "@/components/GuideCard";
import { PressReviewCard } from "@/components/PressReviewCard";
import { OwnerReviewsSection } from "@/components/OwnerReviewsSection";
import { MonthlyPriceBars } from "@/components/MonthlyPriceBars";
import { publishedNow } from "@/lib/blog-publication";
import { ListingCard } from "@/components/search/ListingCard";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { estimateFromIndex, indexComparables } from "@/lib/price-estimation";
import { computePriceBadge } from "@/lib/price-badge";
import { getSellerTrustSummariesForSellers } from "@/lib/seller-trust";
import { getSellerResponsivenessCached } from "@/lib/seller-responsiveness-service";
import { cardSellerBadges } from "@/lib/seller-card-badges";
import { getProfessionalBadgesForSellers } from "@/lib/professional-accounts";
import { formatNumber } from "@/lib/format";

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

  const description = t("modelMetaDescription", { brand: found.brand.name, model: found.model.name });
  return {
    title: `${title} — Souq Autos`,
    description,
    alternates: localizedAlternates(canonical),
    openGraph: { title, description, url: canonical, type: "website" },
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
  const tRoadTest = await getTranslations("RoadTest");
  const tGuide = await getTranslations("Guide");
  const tPress = await getTranslations("PressReview");

  const [stats, priceHistory, listings, currentUser, roadTests, guides, pressReviews, pressTotal] = await Promise.all([
    getListingStats({ brandId: brand.id, modelId: model.id }),
    getModelPriceHistory({ brandId: brand.id, modelId: model.id }),
    prisma.listing.findMany({
      where: { brandId: brand.id, modelId: model.id, status: "PUBLIEE" },
      orderBy: { createdAt: "desc" },
      take: 24,
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
    // Lot 110 — essais parus de ce modèle (les 3 derniers).
    prisma.blogArticle.findMany({
      where: { kind: "ESSAI", ...publishedNow(new Date()), roadTest: { modelId: model.id } },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        id: true,
        slug: true,
        titleFr: true,
        titleAr: true,
        excerptFr: true,
        excerptAr: true,
        publishedAt: true,
        coverImageUrl: true,
        roadTest: { select: { rating: true, brand: { select: { name: true } }, model: { select: { name: true } } } },
      },
    }),
    // Lot 126 — guides d'achat parus de ce modèle (les 2 derniers).
    prisma.blogArticle.findMany({
      where: { kind: "GUIDE", ...publishedNow(new Date()), guide: { modelId: model.id } },
      orderBy: { publishedAt: "desc" },
      take: 2,
      select: guideCardSelect,
    }),
    // Lot 114 — ce qu'en dit la presse : liens vers des essais publiés ailleurs
    // (les 3 derniers de ce modèle + le total pour afficher le lien « voir tout »).
    prisma.pressReview.findMany({
      where: { ...publishedNow(new Date()), modelId: model.id },
      orderBy: { publishedAt: "desc" },
      take: 3,
      include: {
        brand: { select: { name: true, slug: true } },
        model: { select: { name: true, slug: true } },
      },
    }),
    prisma.pressReview.count({ where: { ...publishedNow(new Date()), modelId: model.id } }),
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
  // Lot 140 — rangé une seule fois par année, pas une fois par annonce de la page.
  const comparableIndex = indexComparables(listings.map((l) => ({ ...l, equipmentIds: l.equipments.map((e) => e.equipmentId) })));
  const priceBadges = new Map(
    listings.map((listing) => {
      const estimate = estimateFromIndex(comparableIndex, {
        year: listing.year,
        mileage: listing.mileage ?? undefined,
        wilayaId: listing.wilayaId,
        equipmentIds: listing.equipments.map((e) => e.equipmentId),
        excludeListingId: listing.id,
      });
      return [listing.id, estimate ? computePriceBadge(listing.price, estimate.mid, estimate.sampleSize) : null];
    })
  );

  const [sellerTrustBySeller, responsivenessBySeller] = await Promise.all([
    getSellerTrustSummariesForSellers(listings.map((l) => l.sellerId)),
    getSellerResponsivenessCached(listings.map((l) => l.sellerId)),
  ]);
  const professionalBadgesBySeller = await getProfessionalBadgesForSellers(listings.map((l) => l.sellerId));

  const breadcrumbItems = [
    { name: t("breadcrumbHome"), href: "/" },
    { name: brand.name, href: `/voitures/${brand.slug}`, lang: "fr" },
    { name: model.name, lang: "fr" },
  ];
  const jsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: brand.name, url: `${SITE_URL}/${locale}/voitures/${brand.slug}` },
    { name: model.name, url: `${SITE_URL}/${locale}/voitures/${brand.slug}/${model.slug}` },
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />

      <Breadcrumbs items={breadcrumbItems} />

      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        <span lang="fr">{brand.name} {model.name}</span>
      </h1>

      {stats.count === 0 ? (
        <p className="mt-4 text-slate-500 dark:text-slate-400">{t("noStatsModel")}</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-xs text-slate-500">{t("statsCount", { count: stats.count })}</p>
          </div>
          {stats.avgPrice && (
            <div>
              <p className="text-xs text-slate-500">{t("avgPrice")}</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{formatNumber(stats.avgPrice, locale)} DA</p>
            </div>
          )}
          {stats.minPrice && stats.maxPrice && (
            <div>
              <p className="text-xs text-slate-500">{t("priceRange")}</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {formatNumber(stats.minPrice, locale)} – {formatNumber(stats.maxPrice, locale)} DA
              </p>
            </div>
          )}
        </div>
      )}

      {priceHistory.length >= 3 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-slate-700 mb-2">{t("priceHistoryTitle")}</h2>
          <MonthlyPriceBars
            points={priceHistory}
            label={t("priceHistoryLabel", { brand: brand.name, model: model.name })}
            locale={locale}
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t("priceHistoryNote")}</p>
        </section>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/cote-souq-auto?brandId=${brand.id}&modelId=${model.id}`}
          className="rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500"
        >
          {t("estimateLink", { brand: brand.name, model: model.name })}
        </Link>
      </div>

      {guides.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{tGuide("modelSectionTitle")}</h2>
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {guides.map((article) => (
              <GuideCard key={article.id} article={article} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {roadTests.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{tRoadTest("modelRoadTestsTitle")}</h2>
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {roadTests.map((article) => (
              <RoadTestCard key={article.id} article={article} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {pressReviews.length > 0 && (
        <section className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{tPress("modelSectionTitle")}</h2>
            {pressTotal > pressReviews.length && (
              <Link href="/essais/revue-de-presse" className="text-sm text-slate-600 underline hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
                {tPress("seeAll", { count: pressTotal })}
              </Link>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tPress("disclaimer")}</p>
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pressReviews.map((item) => (
              <PressReviewCard key={item.id} item={item} locale={locale} />
            ))}
          </div>
        </section>
      )}

      <OwnerReviewsSection
        modelId={model.id}
        locale={locale}
        viewer={currentUser ? { id: currentUser.id, emailVerified: Boolean(currentUser.emailVerifiedAt) } : null}
        currentYear={new Date().getFullYear()}
      />

      {listings.length > 0 && (
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing, index) => (
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
      )}

      {stats.count > 0 && (
        <Link
          href={`/recherche?brandId=${brand.id}&modelId=${model.id}`}
          className="mt-8 inline-block rounded-md bg-slate-900 dark:bg-slate-100 px-4 py-2 text-sm font-medium text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300"
        >
          {t("viewAllModelListings", { brand: brand.name, model: model.name })}
        </Link>
      )}
    </div>
  );
}
