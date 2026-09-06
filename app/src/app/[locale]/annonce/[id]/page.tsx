import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { computeAverageRating } from "@/lib/reviews";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { sweepExpiredListings } from "@/lib/listing-expiry-sweep";
import { sweepAutoRenewals } from "@/lib/listing-auto-renew-sweep";
import { sweepExpiringListingsForReminders } from "@/lib/listing-expiry-reminder-sweep";
import {
  checkListingRenewable,
  checkListingCanBeMarkedSold,
  checkListingPriceEditable,
  checkListingContentEditable,
} from "@/lib/listing-lifecycle";
import { ListingLifecycleActions } from "@/components/ListingLifecycleActions";
import { ListingPriceEditor } from "@/components/ListingPriceEditor";
import { PhoneReveal } from "@/components/PhoneReveal";
import { estimatePrice } from "@/lib/price-estimation";
import { computePriceBadge } from "@/lib/price-badge";
import { PRICE_BADGE_STYLE, PRICE_BADGE_KEY } from "@/lib/price-badge-style";
import { FavoriteButton } from "@/components/FavoriteButton";
import { CompareToggle } from "@/components/compare/CompareToggle";
import { ContactSellerButton } from "@/components/ContactSellerButton";
import { ReportListingButton } from "@/components/ReportListingButton";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/site";
import { buildVehicleJsonLd, buildBreadcrumbJsonLd } from "@/lib/structured-data";

const BADGE_STYLE = PRICE_BADGE_STYLE;
const BADGE_KEY = PRICE_BADGE_KEY;

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { photos: { orderBy: { position: "asc" }, take: 1 }, brand: true, model: true },
  });
  if (!listing || listing.status !== "PUBLIEE") return {};

  const brandLabel = listing.brand?.name ?? listing.brandFreeText ?? "";
  const modelLabel = listing.model?.name ?? listing.modelFreeText ?? "";
  const title = `${listing.title} — ${brandLabel} ${modelLabel} ${listing.year}`.trim();
  const canonical = `${SITE_URL}/${locale}/annonce/${listing.id}`;
  const image = listing.photos[0] ? `${SITE_URL}${listing.photos[0].path}` : undefined;

  return {
    title: `${title} — Souq Auto`,
    description: listing.description.slice(0, 160),
    alternates: { canonical },
    openGraph: {
      title,
      description: listing.description.slice(0, 160),
      url: canonical,
      type: "website",
      images: image ? [image] : undefined,
    },
  };
}

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{ published?: string }>;
}) {
  const { id } = await params;
  const { published } = await searchParams;
  const locale = await getLocale();
  const tListing = await getTranslations("Listing");
  const tWizard = await getTranslations("Wizard");
  const tEstimate = await getTranslations("Estimate");

  await sweepAutoRenewals();
  await sweepExpiredListings();
  await sweepExpiringListingsForReminders();

  const [listing, currentUser] = await Promise.all([
    prisma.listing.findUnique({
      where: { id },
      include: {
        photos: { orderBy: { position: "asc" } },
        brand: true,
        model: true,
        wilaya: true,
        commune: true,
        generation: true,
        seller: { include: { profile: true, professionalAccount: true } },
        priceHistory: { orderBy: { recordedAt: "desc" } },
        renewals: { orderBy: { renewedAt: "desc" } },
        equipments: { include: { equipment: true } },
      },
    }),
    getCurrentUser(),
  ]);

  const isOwner = currentUser?.id === listing?.sellerId;
  if (!listing || (listing.status !== "PUBLIEE" && !isOwner)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-slate-600">{tListing("notFound")}</p>
      </div>
    );
  }

  if (!isOwner) {
    await prisma.listing.update({
      where: { id: listing.id },
      data: { views: { increment: 1 } },
    });
  }

  const brandLabel = listing.brand?.name ?? listing.brandFreeText ?? "";
  const modelLabel = listing.model?.name ?? listing.modelFreeText ?? "";
  const wilayaLabel = locale === "ar" ? listing.wilaya.nomAr : listing.wilaya.nomFr;
  const communeLabel = listing.commune ? (locale === "ar" ? listing.commune.nomAr : listing.commune.nomFr) : null;
  const locationLabel = communeLabel ? `${communeLabel}, ${wilayaLabel}` : wilayaLabel;

  const tPriceBadge = await getTranslations("PriceBadge");
  const estimate =
    listing.brandId && listing.modelId
      ? await estimatePrice({
          brandId: listing.brandId,
          modelId: listing.modelId,
          year: listing.year,
          mileage: listing.mileage,
          wilayaId: listing.wilayaId,
          equipmentIds: listing.equipments.map((e) => e.equipmentId),
          excludeListingId: listing.id,
        })
      : null;
  const priceBadge = estimate
    ? computePriceBadge(listing.price, estimate.mid, estimate.sampleSize)
    : null;

  const tFavorites = await getTranslations("Favorites");
  const tCompare = await getTranslations("Compare");
  const tCatalogue = await getTranslations("Catalogue");
  const isFavorited = currentUser
    ? Boolean(
        await prisma.favorite.findUnique({
          where: { userId_listingId: { userId: currentUser.id, listingId: listing.id } },
        })
      )
    : false;
  const alreadyReported = currentUser
    ? Boolean(
        await prisma.report.findUnique({
          where: { listingId_authorId: { listingId: listing.id, authorId: currentUser.id } },
        })
      )
    : false;

  const tReview = await getTranslations("Review");
  const tPro = await getTranslations("Pro");
  const sellerReviews = await prisma.review.findMany({
    where: { sellerId: listing.sellerId },
    select: { rating: true },
  });
  const sellerRating = computeAverageRating(sellerReviews.map((r) => r.rating));

  const listingUrl = `${SITE_URL}/${locale}/annonce/${listing.id}`;
  const vehicleJsonLd = buildVehicleJsonLd({
    title: listing.title,
    description: listing.description,
    url: listingUrl,
    images: listing.photos.map((p) => `${SITE_URL}${p.path}`),
    price: listing.price,
    brandName: listing.brand?.name,
    modelName: listing.model?.name,
    year: listing.year,
    mileage: listing.mileage,
    fuelTypeLabel: tWizard(FUEL_KEY[listing.fuelType]),
    gearboxLabel: tWizard(GEARBOX_KEY[listing.gearbox]),
  });

  const breadcrumbItems = [
    { name: tCatalogue("breadcrumbHome"), href: "/" },
    ...(listing.brand ? [{ name: listing.brand.name, href: `/voitures/${listing.brand.slug}` }] : []),
    ...(listing.brand && listing.model
      ? [{ name: listing.model.name, href: `/voitures/${listing.brand.slug}/${listing.model.slug}` }]
      : []),
    { name: listing.title },
  ];
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    breadcrumbItems.map((item) => ({
      name: item.name,
      url: item.href ? `${SITE_URL}/${locale}${item.href === "/" ? "" : item.href}` : listingUrl,
    }))
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(vehicleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <Breadcrumbs items={breadcrumbItems} />

      {published === "1" && (
        <div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="font-medium text-emerald-800">{tListing("successTitle")}</p>
          <p className="text-sm text-emerald-700">{tListing("successBody")}</p>
        </div>
      )}

      {isOwner && listing.status !== "PUBLIEE" && (
        <div
          className={`mb-6 rounded-md border px-4 py-3 ${
            listing.status === "EN_ATTENTE"
              ? "border-amber-200 bg-amber-50"
              : listing.status === "EXPIREE" || listing.status === "BROUILLON"
                ? "border-slate-200 bg-slate-50"
                : listing.status === "VENDUE"
                  ? "border-blue-200 bg-blue-50"
                  : "border-red-200 bg-red-50"
          }`}
        >
          <p
            className={`font-medium ${
              listing.status === "EN_ATTENTE"
                ? "text-amber-800"
                : listing.status === "EXPIREE" || listing.status === "BROUILLON"
                  ? "text-slate-700"
                  : listing.status === "VENDUE"
                    ? "text-blue-800"
                    : "text-red-800"
            }`}
          >
            {listing.status === "EN_ATTENTE"
              ? tListing("pendingBannerTitle")
              : listing.status === "REFUSEE"
                ? tListing("rejectedBannerTitle")
                : listing.status === "SUSPENDUE"
                  ? tListing("suspendedBannerTitle")
                  : listing.status === "EXPIREE"
                    ? tListing("expiredBannerTitle")
                    : listing.status === "VENDUE"
                      ? tListing("soldBannerTitle")
                      : tListing("draftBannerTitle")}
          </p>
          {listing.status === "EN_ATTENTE" && (
            <p className="text-sm text-amber-700">{tListing("pendingBannerBody")}</p>
          )}
          {(listing.status === "REFUSEE" || listing.status === "SUSPENDUE") &&
            listing.moderationNote && (
              <p className="text-sm text-red-700">
                {tListing("moderationReasonLabel")}: {listing.moderationNote}
              </p>
            )}
          {listing.status === "EXPIREE" && (
            <p className="text-sm text-slate-600">{tListing("expiredBannerBody")}</p>
          )}
          {listing.status === "VENDUE" && (
            <p className="text-sm text-blue-700">{tListing("soldBannerBody")}</p>
          )}
          {listing.status === "EXPIREE" && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <ListingLifecycleActions
                listingId={listing.id}
                canRenew={checkListingRenewable(listing.status).ok}
                canMarkSold={checkListingCanBeMarkedSold(listing.status).ok}
                renewLabel={tListing("renewAction")}
                markSoldLabel={tListing("markSoldAction")}
                errorLabel={tListing("lifecycleErrorGeneric")}
              />
              {checkListingPriceEditable(listing.status).ok && (
                <ListingPriceEditor
                  listingId={listing.id}
                  currentPrice={listing.price}
                  newPriceLabel={tListing("newPriceLabel")}
                  editLabel={tListing("editPriceAction")}
                  saveLabel={tListing("savePriceAction")}
                  cancelLabel={tListing("cancelAction")}
                  errorLabel={tListing("lifecycleErrorGeneric")}
                />
              )}
              {checkListingContentEditable(listing.status).ok && (
                <Link
                  href={`/compte/mes-annonces/${listing.id}/modifier`}
                  className="text-xs text-slate-500 underline hover:text-slate-700"
                >
                  {tListing("editListingAction")}
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {isOwner && listing.status === "PUBLIEE" && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {listing.expiresAt && (
            <p className="text-xs text-slate-400">
              {tListing("expiresOnLabel", {
                date: new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
                  dateStyle: "long",
                }).format(listing.expiresAt),
              })}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <ListingLifecycleActions
              listingId={listing.id}
              canRenew={checkListingRenewable(listing.status).ok}
              canMarkSold={checkListingCanBeMarkedSold(listing.status).ok}
              renewLabel={tListing("renewAction")}
              markSoldLabel={tListing("markSoldAction")}
              errorLabel={tListing("lifecycleErrorGeneric")}
            />
            {checkListingPriceEditable(listing.status).ok && (
              <ListingPriceEditor
                listingId={listing.id}
                currentPrice={listing.price}
                newPriceLabel={tListing("newPriceLabel")}
                editLabel={tListing("editPriceAction")}
                saveLabel={tListing("savePriceAction")}
                cancelLabel={tListing("cancelAction")}
                errorLabel={tListing("lifecycleErrorGeneric")}
              />
            )}
            {checkListingContentEditable(listing.status).ok && (
              <Link
                href={`/compte/mes-annonces/${listing.id}/modifier`}
                className="text-xs text-slate-500 underline hover:text-slate-700"
              >
                {tListing("editListingAction")}
              </Link>
            )}
          </div>
        </div>
      )}

      {listing.photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
          {listing.photos.map((photo, i) => (
            <div
              key={photo.id}
              className={`relative aspect-[4/3] ${i === 0 ? "col-span-2 sm:col-span-2 sm:row-span-2" : ""}`}
            >
              <Image
                src={photo.path}
                alt={listing.title}
                fill
                className="rounded-md object-cover border border-slate-200"
                sizes="(max-width: 640px) 50vw, 33vw"
              />
            </div>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-8">
        <div className="sm:col-span-2">
          <h1 className="text-2xl font-semibold text-slate-900 text-balance">{listing.title}</h1>
          <p className="mt-1 text-slate-500">
            {brandLabel} {modelLabel} · {tListing("yearLabel", { value: listing.year })} ·{" "}
            {tListing("mileageUnit", { value: listing.mileage.toLocaleString() })}
          </p>

          <div className="mt-6">
            <h2 className="text-sm font-medium text-slate-700 mb-2">{tListing("descriptionTitle")}</h2>
            <p className="text-slate-700 whitespace-pre-wrap">{listing.description}</p>
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-medium text-slate-700 mb-2">{tListing("detailsTitle")}</h2>
            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-sm">
              {listing.generation && (
                <DetailRow
                  label={tWizard("generation")}
                  value={`${listing.generation.name} (${listing.generation.yearStart}–${listing.generation.yearEnd ?? tWizard("generationOngoing")})`}
                />
              )}
              <DetailRow label={tWizard("fuelType")} value={tWizard(FUEL_KEY[listing.fuelType])} />
              <DetailRow label={tWizard("gearbox")} value={tWizard(GEARBOX_KEY[listing.gearbox])} />
              <DetailRow
                label={tWizard("condition")}
                value={listing.condition === "NEUF" ? tListing("conditionNeuf") : tListing("conditionOccasion")}
              />
              {listing.firstHand && <DetailRow label={tListing("firstHand")} value="✓" />}
              {listing.accidented && <DetailRow label={tListing("accidented")} value="✓" />}
              {listing.color && <DetailRow label={tWizard("color")} value={listing.color} />}
              {listing.powerHp && <DetailRow label={tWizard("powerHp")} value={`${listing.powerHp} ch`} />}
            </div>
          </div>

          {listing.equipments.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-slate-700 mb-2">{tListing("equipmentsTitle")}</h2>
              <div className="flex flex-wrap gap-2">
                {listing.equipments.map(({ equipment }) => (
                  <span
                    key={equipment.id}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                  >
                    {locale === "ar" ? equipment.nameAr : equipment.nameFr}
                  </span>
                ))}
              </div>
            </div>
          )}

          {estimate && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-slate-700 mb-2">{tPriceBadge("estimationTitle")}</h2>
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-sm">
                <DetailRow label={tPriceBadge("priceRequested")} value={`${listing.price.toLocaleString()} DA`} />
                <DetailRow label={tPriceBadge("priceMarket")} value={`${estimate.mid.toLocaleString()} DA`} />
                {priceBadge && (
                  <DetailRow
                    label={tPriceBadge("deviationLabel")}
                    value={
                      priceBadge.deviationPct >= 0
                        ? tPriceBadge("deviationAbove", { value: priceBadge.deviationPct })
                        : tPriceBadge("deviationBelow", { value: priceBadge.deviationPct })
                    }
                  />
                )}
              </div>
              <p className="mt-2 text-xs text-slate-400">{tEstimate("disclaimer")}</p>
            </div>
          )}

          {listing.priceHistory.length > 1 && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-slate-700 mb-2">{tListing("priceHistoryTitle")}</h2>
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-sm">
                {listing.priceHistory.map((entry) => (
                  <DetailRow
                    key={entry.id}
                    label={new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
                      dateStyle: "long",
                    }).format(entry.recordedAt)}
                    value={`${entry.price.toLocaleString()} DA`}
                  />
                ))}
              </div>
            </div>
          )}

          {listing.renewals.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-slate-700 mb-2">{tListing("renewalHistoryTitle")}</h2>
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-sm">
                {listing.renewals.map((entry) => (
                  <DetailRow
                    key={entry.id}
                    label={new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
                      dateStyle: "long",
                    }).format(entry.renewedAt)}
                    value={tListing("renewalUntil", {
                      date: new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
                        dateStyle: "long",
                      }).format(entry.expiresAt),
                    })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sm:col-span-1">
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-2xl font-semibold text-slate-900">
                {listing.price.toLocaleString()} DA
              </p>
              <div className="flex gap-2 shrink-0">
                <FavoriteButton
                  listingId={listing.id}
                  initialFavorited={isFavorited}
                  isLoggedIn={Boolean(currentUser)}
                  label={
                    isFavorited ? tFavorites("removeFromFavorites") : tFavorites("addToFavorites")
                  }
                />
                <CompareToggle listingId={listing.id} label={tCompare("addToCompare")} />
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-1">{locationLabel}</p>

            {priceBadge && (
              <div className={`mt-4 rounded-md border px-3 py-2 ${BADGE_STYLE[priceBadge.badge]}`}>
                <p className="text-sm font-medium">{tPriceBadge(BADGE_KEY[priceBadge.badge])}</p>
                <p className="text-xs mt-0.5 opacity-80">
                  {priceBadge.deviationPct >= 0
                    ? tPriceBadge("deviationAbove", { value: priceBadge.deviationPct })
                    : tPriceBadge("deviationBelow", { value: priceBadge.deviationPct })}
                </p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 mb-1">{tListing("seller")}</p>
              <Link href={`/vendeur/${listing.sellerId}`} className="font-medium text-slate-900 hover:underline">
                {listing.seller.profile?.displayName ?? listing.seller.email}
              </Link>
              {sellerRating.count > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">
                  {"★".repeat(Math.round(sellerRating.average))}{" "}
                  {tReview("averageRating", { average: sellerRating.average, count: sellerRating.count })}
                </p>
              )}
              {listing.seller.professionalAccount && (
                <Link
                  href={`/pro/${listing.seller.professionalAccount.id}`}
                  className="mt-1 inline-block text-xs text-slate-500 hover:underline"
                >
                  {tPro("viewShopLink", { name: listing.seller.professionalAccount.nomCommercial })}
                </Link>
              )}
            </div>

            {!isOwner && (
              <div className="mt-4 space-y-2">
                <ContactSellerButton listingId={listing.id} isLoggedIn={Boolean(currentUser)} />
                {listing.seller.phone && (
                  <PhoneReveal phone={listing.seller.phone} label={tListing("showPhone")} />
                )}
                <div className="pt-2 text-right">
                  <ReportListingButton
                    listingId={listing.id}
                    isLoggedIn={Boolean(currentUser)}
                    initialAlreadyReported={alreadyReported}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2.5 flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium text-right">{value}</span>
    </div>
  );
}
