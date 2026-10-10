import type { Metadata } from "next";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { localizedAlternates } from "@/lib/seo-alternates";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { locale } = await params;
  const raw = await searchParams;
  const t = await getTranslations({ locale, namespace: "Search" });
  const canonical = `${SITE_URL}/${locale}/recherche`;

  let title = `${t("pageTitle")} — Souq Auto`;
  const q = typeof raw.q === "string" ? raw.q.trim() : undefined;
  if (q) title = `${q} — ${t("pageTitle")}`;

  return {
    title,
    description: t("metaDescription"),
    alternates: localizedAlternates(canonical),
    openGraph: { title, url: canonical, type: "website" },
  };
}
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { sweepExpiredListings } from "@/lib/listing-expiry-sweep";
import { sweepExpiringListingsForReminders } from "@/lib/listing-expiry-reminder-sweep";
import { sweepAutoRenewals } from "@/lib/listing-auto-renew-sweep";
import { throttledSweep } from "@/lib/sweeper-throttle";
import { searchParamsSchema, PAGE_SIZE } from "@/lib/validation/search";
import {
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
import { getSearchBrands, getSearchEquipments, getSearchWilayasLight } from "@/lib/reference-data";
import { resolveListingWhere } from "@/lib/search-query";
import { ListingCard } from "@/components/search/ListingCard";
import { Pagination } from "@/components/search/Pagination";
import { estimatePricesForListings } from "@/lib/price-estimation";
import { computePriceBadge } from "@/lib/price-badge";
import { getSellerTrustSummariesForSellers } from "@/lib/seller-trust";
import { getSellerResponsivenessCached } from "@/lib/seller-responsiveness-service";
import { cardSellerBadges } from "@/lib/seller-card-badges";
import { getProfessionalBadgesForSellers } from "@/lib/professional-accounts";
import { getSellerRatingsForSellers } from "@/lib/seller-review-service";

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

  // Lot 215 — throttle 30 s pour ne pas relancer les sweepers à chaque recherche
  // Lot 268 (audit B3) — seule l'expiration est attendue ; rappels et renouvellements (courriels) partent après la réponse.
  await throttledSweep("expired-listings", sweepExpiredListings);
  after(() => Promise.all([throttledSweep("auto-renewals", sweepAutoRenewals), throttledSweep("expiry-reminders", sweepExpiringListingsForReminders)]));

  const where = await resolveListingWhere(params); // Lot 139 : mot cherché d'abord dans le catalogue (en cache), puis requête sans jointure
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
    // Lot 137 — référentiel en cache mémoire (5 min) : il était rechargé à chaque visite et pesait 42 % du temps du serveur.
    getSearchBrands(),
    getSearchWilayasLight(),
    getSearchEquipments(),
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

  const sellerIds = allListings.map((l) => l.sellerId);
  const [sellerTrustBySeller, responsivenessBySeller, sellerRatingsBySeller] = await Promise.all([
    getSellerTrustSummariesForSellers(sellerIds),
    getSellerResponsivenessCached(sellerIds),
    getSellerRatingsForSellers(sellerIds),
  ]);
  const professionalBadgesBySeller = await getProfessionalBadgesForSellers(sellerIds);

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
            sellerType: flatParams.sellerType,
            categoryPro: flatParams.categoryPro,
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
          <p className="mb-3 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
            {t("aiSearchNotice")}
          </p>
        )}

        {featuredListings.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("featuredTitle")}</h2>
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
                  sellerBadges={cardSellerBadges(sellerTrustBySeller.get(listing.sellerId), responsivenessBySeller.get(listing.sellerId))}
                  professionalBadge={professionalBadgesBySeller.get(listing.sellerId)}
                  sellerRating={sellerRatingsBySeller.get(listing.sellerId)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <p role="status" aria-live="polite" className="text-sm text-slate-500 dark:text-slate-400">{t("resultsCount", { count: totalCount })}</p>
          <SortSelect current={params.sort ?? "recent"} />
        </div>

        {/* « Aucune annonce » seulement s'il n'y a vraiment rien à afficher : quand
            toutes les annonces correspondantes sont déjà en avant (ci-dessus, et donc
            exclues de la liste normale), la liste normale est vide mais la page ne l'est pas. */}
        {allListings.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 py-12 text-center">{t("noResults")}</p>
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
                  sellerBadges={cardSellerBadges(sellerTrustBySeller.get(listing.sellerId), responsivenessBySeller.get(listing.sellerId))}
                  professionalBadge={professionalBadgesBySeller.get(listing.sellerId)}
                  sellerRating={sellerRatingsBySeller.get(listing.sellerId)}
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
