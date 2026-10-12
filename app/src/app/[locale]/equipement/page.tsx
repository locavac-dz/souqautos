import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { localizedAlternates } from "@/lib/seo-alternates";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { searchParamsSchema, PAGE_SIZE } from "@/lib/validation/search";
import {
  buildListingWhere,
  buildListingOrderBy,
  currentPage,
  paginationOffset,
  totalPages as computeTotalPages,
  listingCardInclude,
} from "@/lib/search";
import { getSearchWilayasLight } from "@/lib/reference-data";
import { ListingCard } from "@/components/search/ListingCard";
import { Pagination } from "@/components/search/Pagination";
import { SortSelect } from "@/components/search/SortSelect";
import { EquipementFilters } from "@/components/equipement/EquipementFilters";
import { getSellerTrustSummariesForSellers } from "@/lib/seller-trust";
import { getSellerResponsivenessCached } from "@/lib/seller-responsiveness-service";
import { cardSellerBadges } from "@/lib/seller-card-badges";
import { getProfessionalBadgesForSellers } from "@/lib/professional-accounts";
import { getSellerRatingsForSellers } from "@/lib/seller-review-service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "EquipementSearch" });
  const canonical = `${SITE_URL}/${locale}/equipement`;
  return {
    title: `${t("pageTitle")} — Souq Autos`,
    description: t("metaDescription"),
    alternates: localizedAlternates(canonical),
    openGraph: { title: `${t("pageTitle")} — Souq Autos`, url: canonical, type: "website" },
  };
}

export default async function EquipementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const flatParams: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(rawParams)) {
    flatParams[key] = Array.isArray(value) ? value[0] : value;
  }

  const params = searchParamsSchema.parse(flatParams);
  const t = await getTranslations("EquipementSearch");

  // Catégorie fixée — ne peut pas être surchargée par l'URL
  const where = buildListingWhere({ ...params, category: "EQUIPEMENT" });
  const orderBy = buildListingOrderBy(params.sort);
  const page = currentPage(params);

  const [wilayas, listings, totalCount, currentUser] = await Promise.all([
    getSearchWilayasLight(),
    prisma.listing.findMany({
      where,
      orderBy,
      skip: paginationOffset(params),
      take: PAGE_SIZE,
      include: listingCardInclude,
    }),
    prisma.listing.count({ where }),
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

  const sellerIds = listings.map((l) => l.sellerId);
  const [sellerTrustBySeller, responsivenessBySeller, sellerRatingsBySeller, professionalBadgesBySeller] =
    await Promise.all([
      getSellerTrustSummariesForSellers(sellerIds),
      getSellerResponsivenessCached(sellerIds),
      getSellerRatingsForSellers(sellerIds),
      getProfessionalBadgesForSellers(sellerIds),
    ]);

  const pages = computeTotalPages(totalCount);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 grid sm:grid-cols-[260px_1fr] gap-8">
      <h1 className="sr-only">{t("pageTitle")}</h1>

      <aside>
        <EquipementFilters
          wilayas={wilayas}
          initialValues={{
            q: flatParams.q,
            priceMin: flatParams.priceMin,
            priceMax: flatParams.priceMax,
            condition: flatParams.condition,
            wilayaId: flatParams.wilayaId,
          }}
        />
      </aside>

      <div>
        <div className="flex items-center justify-between mb-4">
          <p role="status" aria-live="polite" className="text-sm text-slate-500 dark:text-slate-400">
            {t("resultsCount", { count: totalCount })}
          </p>
          <SortSelect current={params.sort ?? "recent"} />
        </div>

        {listings.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 py-12 text-center">{t("noResults")}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((listing, index) => (
              <ListingCard
                eager={index < 3}
                key={listing.id}
                listing={listing}
                isLoggedIn={Boolean(currentUser)}
                isFavorited={favoriteIds.has(listing.id)}
                priceBadge={null}
                sellerTrustScore={sellerTrustBySeller.get(listing.sellerId)?.trustBreakdown.score}
                sellerBadges={cardSellerBadges(
                  sellerTrustBySeller.get(listing.sellerId),
                  responsivenessBySeller.get(listing.sellerId)
                )}
                professionalBadge={professionalBadgesBySeller.get(listing.sellerId)}
                sellerRating={sellerRatingsBySeller.get(listing.sellerId)}
              />
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={pages} searchParams={flatParams} basePath="/equipement" />
      </div>
    </div>
  );
}
