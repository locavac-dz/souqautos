import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { sweepExpiredListings } from "@/lib/listing-expiry-sweep";
import { sweepExpiringListingsForReminders } from "@/lib/listing-expiry-reminder-sweep";
import { sweepAutoRenewals } from "@/lib/listing-auto-renew-sweep";
import { searchParamsSchema, PAGE_SIZE } from "@/lib/validation/search";
import {
  buildListingWhere,
  buildListingOrderBy,
  currentPage,
  paginationOffset,
  totalPages as computeTotalPages,
  listingCardInclude,
  type ListingWithCardRelations,
} from "@/lib/search";
import { SearchFilters } from "@/components/search/SearchFilters";
import { SaveSearchAlertForm } from "@/components/search/SaveSearchAlertForm";
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

  await sweepAutoRenewals();
  await sweepExpiredListings();
  await sweepExpiringListingsForReminders();

  const where = buildListingWhere(params);
  const orderBy = buildListingOrderBy(params.sort);
  const page = currentPage(params);

  // Annonces en avant (Lot 66, § « Premium : remontée dans les résultats ») :
  // uniquement sur la première page — les répéter à chaque page paginée
  // n'aurait aucun sens — et jamais dupliquées avec les résultats normaux
  // ci-dessous. PREMIUM_PLUS d'abord (deux requêtes bornées plutôt qu'un tri
  // par formule : un enum SQLite se trie alphabétiquement, pas dans l'ordre
  // de déclaration — "PREMIUM" < "PREMIUM_PLUS" < "STANDARD" ne donnerait
  // jamais le classement voulu).
  const FEATURED_LIMIT = 3;
  let featuredListings: ListingWithCardRelations[] = [];
  if (page === 1) {
    const featuredPlus = await prisma.listing.findMany({
      where: { ...where, formula: "PREMIUM_PLUS" },
      orderBy: { publishedAt: "desc" },
      take: FEATURED_LIMIT,
      include: listingCardInclude,
    });
    const featuredPremium =
      featuredPlus.length < FEATURED_LIMIT
        ? await prisma.listing.findMany({
            where: { ...where, formula: "PREMIUM", id: { notIn: featuredPlus.map((l) => l.id) } },
            orderBy: { publishedAt: "desc" },
            take: FEATURED_LIMIT - featuredPlus.length,
            include: listingCardInclude,
          })
        : [];
    featuredListings = [...featuredPlus, ...featuredPremium];
  }
  const featuredIds = featuredListings.map((l) => l.id);

  const [brands, wilayas, equipments, listings, totalCount, currentUser] = await Promise.all([
    prisma.brand.findMany({
      include: { models: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.wilaya.findMany({
      orderBy: { id: "asc" },
      include: { communes: { orderBy: { nomFr: "asc" } } },
    }),
    prisma.equipment.findMany({
      orderBy: { nameFr: "asc" },
      select: { id: true, nameFr: true, nameAr: true, category: true },
    }),
    prisma.listing.findMany({
      where: featuredIds.length > 0 ? { ...where, id: { notIn: featuredIds } } : where,
      orderBy,
      skip: paginationOffset(params),
      take: PAGE_SIZE,
      include: listingCardInclude,
    }),
    prisma.listing.count({ where }),
    getCurrentUser(),
  ]);

  const allListings = [...featuredListings, ...listings];

  const favoriteIds = currentUser
    ? new Set(
        (
          await prisma.favorite.findMany({
            where: { userId: currentUser.id, listingId: { in: allListings.map((l) => l.id) } },
            select: { listingId: true },
          })
        ).map((f) => f.listingId)
      )
    : new Set<string>();

  const estimates = await estimatePricesForListings(
    allListings.map((l) => ({ ...l, equipmentIds: l.equipments.map((e) => e.equipmentId) }))
  );
  const priceBadges = new Map(
    allListings.map((listing) => {
      const estimate = estimates.get(listing.id);
      return [listing.id, estimate ? computePriceBadge(listing.price, estimate.mid, estimate.sampleSize) : null];
    })
  );

  const sellerTrustBySeller = await getSellerTrustSummariesForSellers(allListings.map((l) => l.sellerId));
  const professionalBadgesBySeller = await getProfessionalBadgesForSellers(allListings.map((l) => l.sellerId));

  const pages = computeTotalPages(totalCount);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 grid sm:grid-cols-[260px_1fr] gap-8">
      {/* Lot 131 — titre de la page pour les lecteurs d'écran et les moteurs de recherche (il n'y en avait pas). */}
      <h1 className="sr-only">{t("pageTitle")}</h1>
      <aside>
        <SearchFilters
          brands={brands}
          wilayas={wilayas}
          equipments={equipments}
          initialValues={{
            q: flatParams.q,
            category: flatParams.category,
            brandId: flatParams.brandId,
            modelId: flatParams.modelId,
            wilayaId: flatParams.wilayaId,
            communeId: flatParams.communeId,
            priceMin: flatParams.priceMin,
            priceMax: flatParams.priceMax,
            yearMin: flatParams.yearMin,
            yearMax: flatParams.yearMax,
            mileageMax: flatParams.mileageMax,
            fuelType: flatParams.fuelType,
            gearbox: flatParams.gearbox,
            condition: flatParams.condition,
            equipmentIds: flatParams.equipmentIds,
          }}
        />
        {currentUser && (
          <div className="mt-4">
            <SaveSearchAlertForm filters={flatParams} />
          </div>
        )}
      </aside>

      <div>
        {flatParams.via === "ai" && (
          <p className="mb-3 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
            {t("aiSearchNotice")}
          </p>
        )}

        {featuredListings.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-slate-700 mb-2">{t("featuredTitle")}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredListings.map((listing, index) => (
                <ListingCard
                  eager={index < 3}
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

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">{t("resultsCount", { count: totalCount })}</p>
          <SortSelect current={params.sort ?? "recent"} />
        </div>

        {/* « Aucune annonce » seulement s'il n'y a vraiment rien à afficher : quand
            toutes les annonces correspondantes sont déjà en avant (ci-dessus, et donc
            exclues de la liste normale), la liste normale est vide mais la page ne l'est pas. */}
        {allListings.length === 0 ? (
          <p className="text-slate-500 py-12 text-center">{t("noResults")}</p>
        ) : (
          listings.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((listing, index) => (
                <ListingCard
                  eager={index < 3}
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
          )
        )}

        <Pagination page={page} totalPages={pages} searchParams={flatParams} />
      </div>
    </div>
  );
}
