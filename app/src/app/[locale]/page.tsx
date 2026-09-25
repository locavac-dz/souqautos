import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { SearchFilters } from "@/components/search/SearchFilters";
import { ListingCard } from "@/components/search/ListingCard";
import { RecentlyViewedSection } from "@/components/RecentlyViewedSection";

// Annonces en vedette (Lot 66) : seule la formule PREMIUM_PLUS obtient une
// mise en avant sur la page d'accueil, cf. docs/ARCHITECTURE.md §11
// (« Premium+ : mise en avant homepage + top de liste »), distincte de
// PREMIUM qui n'est boosté que dans les résultats de recherche.
const FEATURED_LIMIT = 4;

export default async function HomePage() {
  const t = await getTranslations("Home");

  const [currentUser, featuredListings] = await Promise.all([
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
  ]);

  const favoriteIds = currentUser
    ? new Set(
        (
          await prisma.favorite.findMany({
            where: { userId: currentUser.id, listingId: { in: featuredListings.map((l) => l.id) } },
            select: { listingId: true },
          })
        ).map((f) => f.listingId)
      )
    : new Set<string>();

  return (
    <div>
      {/* Hero — bande colorée pleine largeur */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold text-white text-balance">
            {t("heroTitle")}
          </h1>
          <p className="mt-3 text-slate-300">{t("heroSubtitle")}</p>

          <div className="mt-8 bg-white dark:bg-slate-800 rounded-xl p-3 shadow-lg dark:shadow-slate-900/50">
            <SearchFilters brands={[]} wilayas={[]} initialValues={{}} compact />
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

      {featuredListings.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{t("featuredTitle")}</h2>
            <Link href="/recherche" className="text-sm text-emerald-600 hover:underline">
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

      {/* Lot 151 — annonces récemment vues, lues côté client depuis localStorage */}
      <div className="mx-auto max-w-6xl px-4 pb-12">
        <RecentlyViewedSection />
      </div>
    </div>
  );
}
