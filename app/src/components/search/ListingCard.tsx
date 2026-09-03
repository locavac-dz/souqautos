import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { FavoriteButton } from "@/components/FavoriteButton";
import { CompareToggle } from "@/components/compare/CompareToggle";
import type { PriceBadge } from "@/lib/price-badge";
import { PRICE_BADGE_STYLE, PRICE_BADGE_KEY } from "@/lib/price-badge-style";

type CardListing = {
  id: string;
  title: string;
  price: number;
  year: number;
  mileage: number;
  fuelType: string;
  gearbox: string;
  views: number;
  createdAt: Date;
  brand: { name: string } | null;
  model: { name: string } | null;
  brandFreeText: string | null;
  modelFreeText: string | null;
  wilaya: { nomFr: string; nomAr: string };
  photos: { path: string }[];
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
}: {
  listing: CardListing;
  isLoggedIn: boolean;
  isFavorited: boolean;
  priceBadge?: { badge: PriceBadge; deviationPct: number } | null;
  sellerTrustScore?: number | null;
  professionalBadge?: { badgeVerifie: boolean } | null;
}) {
  const locale = await getLocale();
  const tWizard = await getTranslations("Wizard");
  const tSearch = await getTranslations("Search");
  const tFavorites = await getTranslations("Favorites");
  const tCompare = await getTranslations("Compare");
  const tPriceBadge = await getTranslations("PriceBadge");
  const tPro = await getTranslations("Pro");

  const brandLabel = listing.brand?.name ?? listing.brandFreeText ?? "";
  const modelLabel = listing.model?.name ?? listing.modelFreeText ?? "";
  const wilayaLabel = locale === "ar" ? listing.wilaya.nomAr : listing.wilaya.nomFr;

  return (
    <Link
      href={`/annonce/${listing.id}`}
      className="block rounded-lg border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-sm transition"
    >
      <div className="relative aspect-[4/3] bg-slate-100">
        {listing.photos[0] ? (
          <Image
            src={listing.photos[0].path}
            alt={listing.title}
            fill
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
          <CompareToggle listingId={listing.id} label={tCompare("addToCompare")} />
        </div>
        {professionalBadge && (
          <span className="absolute top-2 rtl:right-2 ltr:left-2 rounded-md bg-slate-900/90 px-2 py-0.5 text-xs font-medium text-white">
            {professionalBadge.badgeVerifie ? tPro("professionalVerifiedBadge") : tPro("professionalBadge")}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="font-medium text-slate-900 line-clamp-2 min-h-[2.5rem]">{listing.title}</p>
        <p className="mt-1 text-sm text-slate-500">
          {brandLabel} {modelLabel} · {listing.year} · {listing.mileage.toLocaleString()} km
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {tWizard(FUEL_KEY[listing.fuelType])} · {tWizard(GEARBOX_KEY[listing.gearbox])}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <p className="text-lg font-semibold text-slate-900">{listing.price.toLocaleString()} DA</p>
          {priceBadge && (
            <span
              className={`rounded-md border px-1.5 py-0.5 text-xs font-medium ${PRICE_BADGE_STYLE[priceBadge.badge]}`}
            >
              {tPriceBadge(PRICE_BADGE_KEY[priceBadge.badge])}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span>{wilayaLabel}</span>
          <span>{tSearch("viewsCount", { count: listing.views })}</span>
        </div>
        {sellerTrustScore !== null && sellerTrustScore !== undefined && (
          <p className="mt-1 text-xs text-slate-400">
            {tSearch("sellerTrustScore", { score: sellerTrustScore })}
          </p>
        )}
      </div>
    </Link>
  );
}
