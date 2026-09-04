import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { sweepExpiredListings } from "@/lib/listing-expiry-sweep";
import { sweepExpiringListingsForReminders } from "@/lib/listing-expiry-reminder-sweep";
import { searchParamsSchema, PAGE_SIZE } from "@/lib/validation/search";
import { buildListingWhere, buildListingOrderBy, currentPage, paginationOffset, totalPages as computeTotalPages } from "@/lib/search";
import { SearchFilters } from "@/components/search/SearchFilters";
import { SortSelect } from "@/components/search/SortSelect";
import { ListingCard } from "@/components/search/ListingCard";
import { Pagination } from "@/components/search/Pagination";
import { estimatePricesForListings } from "@/lib/price-estimation";
import { computePriceBadge } from "@/lib/price-badge";
import { getSellerTrustSummariesForSellers } from "@/lib/seller-trust";
import { getProfessionalBadgesForSellers } from "@/lib/professional-accounts";

export default async function SearchPage({
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
  const t = await getTranslations("Search");

  await sweepExpiredListings();
  await sweepExpiringListingsForReminders();

  const where = buildListingWhere(params);
  const orderBy = buildListingOrderBy(params.sort);
  const page = currentPage(params);

  const [brands, wilayas, listings, totalCount, currentUser] = await Promise.all([
    prisma.brand.findMany({
      include: { models: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.wilaya.findMany({ orderBy: { id: "asc" } }),
    prisma.listing.findMany({
      where,
      orderBy,
      skip: paginationOffset(params),
      take: PAGE_SIZE,
      include: {
        brand: true,
        model: true,
        wilaya: true,
        photos: { orderBy: { position: "asc" }, take: 1 },
      },
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

  const estimates = await estimatePricesForListings(listings);
  const priceBadges = new Map(
    listings.map((listing) => {
      const estimate = estimates.get(listing.id);
      return [listing.id, estimate ? computePriceBadge(listing.price, estimate.mid, estimate.sampleSize) : null];
    })
  );

  const sellerTrustBySeller = await getSellerTrustSummariesForSellers(listings.map((l) => l.sellerId));
  const professionalBadgesBySeller = await getProfessionalBadgesForSellers(listings.map((l) => l.sellerId));

  const pages = computeTotalPages(totalCount);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 grid sm:grid-cols-[260px_1fr] gap-8">
      <aside>
        <SearchFilters
          brands={brands}
          wilayas={wilayas}
          initialValues={{
            q: flatParams.q,
            category: flatParams.category,
            brandId: flatParams.brandId,
            modelId: flatParams.modelId,
            wilayaId: flatParams.wilayaId,
            priceMin: flatParams.priceMin,
            priceMax: flatParams.priceMax,
            yearMin: flatParams.yearMin,
            yearMax: flatParams.yearMax,
            mileageMax: flatParams.mileageMax,
            fuelType: flatParams.fuelType,
            gearbox: flatParams.gearbox,
            condition: flatParams.condition,
          }}
        />
      </aside>

      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">{t("resultsCount", { count: totalCount })}</p>
          <SortSelect current={params.sort ?? "recent"} />
        </div>

        {listings.length === 0 ? (
          <p className="text-slate-500 py-12 text-center">{t("noResults")}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

        <Pagination page={page} totalPages={pages} searchParams={flatParams} />
      </div>
    </div>
  );
}
