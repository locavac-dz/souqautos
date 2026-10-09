import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { FavoriteButton } from "@/components/FavoriteButton";
import { CompareToggle } from "@/components/compare/CompareToggle";
import type { PriceBadge } from "@/lib/price-badge";
import { PRICE_BADGE_STYLE, PRICE_BADGE_KEY } from "@/lib/price-badge-style";
import { resolveListingLabels } from "@/lib/site";
import { formatNumber } from "@/lib/format";
import { CheckMark } from "@/components/SellerTrustBadges";
import type { CardSellerBadges } from "@/lib/seller-card-badges";
import type { SellerRating } from "@/lib/seller-review-service";

type CardListing = {
  id: string;
  title: string;
  price: number;
  year: number;
  mileage: number | null;
  fuelType: string | null;
  gearbox: string | null;
  formula: string;
  // Lot 265 — le comparateur ne compare que des véhicules : pas de bouton « Comparer » sur un équipement.
  category?: string | null;
  views: number;
  createdAt: Date;
  brand: { name: string } | null;
  model: { name: string } | null;
  brandFreeText: string | null;
  modelFreeText: string | null;
  wilaya: { nomFr: string; nomAr: string };
  commune: { nomFr: string; nomAr: string } | null;
  photos: { path: string }[];
  controltechniqueExpiry: Date | null;
  assuranceExpiry: Date | null;
  negotiable: boolean;
};

const FUEL_KEY: Record<string, string> = {
  ESSENCE: "fuelEssence",
  DIESEL: "fuelDiesel",
  GPL: "fuelGpl",
  HYBRIDE: "fuelHybride",
  ELECTRIQUE: "fuelElectrique",
};
const GEARBOX_KEY: Record<string, string> = {
  MANUELLE: "gearboxManuelle",
  AUTOMATIQUE: "gearboxAutomatique",
};

export async function ListingCard({
  listing,
  isLoggedIn,
  isFavorited,
  priceBadge,
  sellerTrustScore,
  professionalBadge,
  sellerBadges,
  sellerRating,
  eager = false,
}: {
  listing: CardListing;
  isLoggedIn: boolean;
  isFavorited: boolean;
  priceBadge?: { badge: PriceBadge; deviationPct: number } | null;
  sellerTrustScore?: number | null;
  professionalBadge?: { badgeVerifie: boolean } | null;
  // Lot 143 — signaux de confiance VÉRIFIÉS du vendeur (identité, réactivité), positifs seulement : `null`/absent = aucune ligne ajoutée.
  sellerBadges?: CardSellerBadges | null;
  // Lot 150 — note moyenne du vendeur issue des avis acheteurs.
  sellerRating?: SellerRating | null;
  // Cartes visibles dès l'ouverture de la page (première rangée) : leur photo est chargée tout de suite, en priorité. Sans cela,
  // le navigateur attend d'avoir mis la page en forme pour la demander, et la plus grande image affichée (LCP) arrive plus tard.
  eager?: boolean;
}) {
  const locale = await getLocale();
  const tWizard = await getTranslations("Wizard");
  const tSearch = await getTranslations("Search");
  const tFavorites = await getTranslations("Favorites");
  const tCompare = await getTranslations("Compare");
  const tPriceBadge = await getTranslations("PriceBadge");
  const tPro = await getTranslations("Pro");
  const tSellerTrust = await getTranslations("SellerTrust");
  const CARD_RESPONSIVENESS_KEY = { under1h: "cardUnder1h", under2h: "cardUnder2h", under6h: "cardUnder6h", under24h: "cardUnder24h" } as const;

  const { brandLabel, modelLabel, wilayaLabel } = resolveListingLabels(listing, locale);
  const communeLabel = listing.commune ? (locale === "ar" ? listing.commune.nomAr : listing.commune.nomFr) : null;
  const locationLabel = communeLabel ? `${communeLabel}, ${wilayaLabel}` : wilayaLabel;

  return (
    <Link
      href={`/annonce/${listing.id}`}
      className="block rounded-lg border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-sm transition dark:border-slate-700 dark:hover:border-slate-600 dark:bg-slate-800"
    >
      <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-700">
        {listing.photos[0] ? (
          <Image
            src={listing.photos[0].path}
            alt=""
            fill
            loading={eager ? "eager" : undefined}
            fetchPriority={eager ? "high" : undefined}
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : null}
        <div className="absolute top-2 rtl:left-2 ltr:right-2 flex flex-col gap-2">
          <FavoriteButton
            listingId={listing.id}
            initialFavorited={isFavorited}
            isLoggedIn={isLoggedIn}
            label={isFavorited ? tFavorites("removeFromFavorites") : tFavorites("addToFavorites")}
          />
          {listing.category !== "EQUIPEMENT" && <CompareToggle listingId={listing.id} label={tCompare("addToCompare")} />}
        </div>
        <div className="absolute top-2 rtl:right-2 ltr:left-2 flex flex-col gap-1">
          {listing.formula !== "STANDARD" && (
            <span className="rounded-md bg-amber-500/90 px-2 py-0.5 text-xs font-medium text-white">
              {listing.formula === "PREMIUM"
                ? tSearch("formulaPremiumBadge")
                : tSearch("formulaPremiumPlusBadge")}
            </span>
          )}
          {professionalBadge && (
            <span className="rounded-md bg-slate-900/90 px-2 py-0.5 text-xs font-medium text-white">
              {professionalBadge.badgeVerifie ? tPro("professionalVerifiedBadge") : tPro("professionalBadge")}
            </span>
          )}
        </div>
      </div>
      <div className="p-3">
        <p className="font-medium text-slate-900 line-clamp-2 min-h-[2.5rem] dark:text-slate-100">{listing.title}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <span lang="fr">{brandLabel} {modelLabel}</span> · {listing.year}{listing.mileage !== null ? ` · ${formatNumber(listing.mileage, locale)} km` : ""}
        </p>
        {listing.fuelType && listing.gearbox && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {tWizard(FUEL_KEY[listing.fuelType])} · {tWizard(GEARBOX_KEY[listing.gearbox])}
          </p>
        )}
        {(() => {
          const now = new Date();
          const vtOk = listing.controltechniqueExpiry && listing.controltechniqueExpiry > now;
          const assurOk = listing.assuranceExpiry && listing.assuranceExpiry > now;
          if (!vtOk && !assurOk) return null;
          return (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {vtOk && (
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {tSearch("ctValid")}
                </span>
              )}
              {assurOk && (
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {tSearch("assuranceValid")}
                </span>
              )}
            </div>
          );
        })()}
        <div className="mt-2 flex items-center gap-2">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formatNumber(listing.price, locale)} DA</p>
          {listing.negotiable && (
            <span className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
              {tSearch("negotiable")}
            </span>
          )}
          {priceBadge && (
            <span
              className={`rounded-md border px-1.5 py-0.5 text-xs font-medium ${PRICE_BADGE_STYLE[priceBadge.badge]}`}
            >
              {tPriceBadge(PRICE_BADGE_KEY[priceBadge.badge])}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{locationLabel}</span>
          <span>{tSearch("viewsCount", { count: listing.views })}</span>
        </div>
        {sellerTrustScore !== null && sellerTrustScore !== undefined && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {tSearch("sellerTrustScore", { score: sellerTrustScore })}
          </p>
        )}
        {sellerBadges && (
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-emerald-800 dark:text-emerald-300">
            {sellerBadges.identityVerified && (
              <li className="flex items-center gap-1">
                <CheckMark />
                {tSellerTrust("identityVerified")}
              </li>
            )}
            {sellerBadges.responsiveness && (
              <li className="flex items-center gap-1">
                <CheckMark />
                {tSellerTrust(CARD_RESPONSIVENESS_KEY[sellerBadges.responsiveness])}
              </li>
            )}
          </ul>
        )}
        {sellerRating && sellerRating.count > 0 && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {tSearch("sellerRatingCard", { average: sellerRating.average, count: sellerRating.count })}
          </p>
        )}
      </div>
    </Link>
  );
}
