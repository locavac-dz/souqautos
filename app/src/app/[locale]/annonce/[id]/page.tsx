import type { Metadata } from "next";
import { headers } from "next/headers";
import { after } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { publishedNow } from "@/lib/blog-publication";
import { computeAverageRating } from "@/lib/reviews";
import { getSellerResponsiveness } from "@/lib/seller-responsiveness-service";
import { SellerTrustBadges } from "@/components/SellerTrustBadges";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isLikelyBot, recordListingView } from "@/lib/view-tracking";
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
import { ContactButtons } from "@/components/ContactButtons";
import { PhotoCredits } from "@/components/PhotoCredits";
import { collectPhotoCredits } from "@/lib/photo-credit";
import { estimatePrice } from "@/lib/price-estimation";
import { computePriceBadge } from "@/lib/price-badge";
import { PRICE_BADGE_STYLE, PRICE_BADGE_KEY } from "@/lib/price-badge-style";
import { FavoriteButton } from "@/components/FavoriteButton";
import { CompareToggle } from "@/components/compare/CompareToggle";
import { ContactSellerButton } from "@/components/ContactSellerButton";
import { ReportListingButton } from "@/components/ReportListingButton";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SITE_URL, resolveAbsolutePhotoUrl } from "@/lib/site";
import { buildVehicleJsonLd, buildBreadcrumbJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { CreditCalculator } from "@/components/CreditCalculator";
import { RecentlyViewedTracker } from "@/components/RecentlyViewedTracker";
import { PhotoGallery } from "@/components/PhotoGallery";
import { RecentlyViewedSection } from "@/components/RecentlyViewedSection";
import { getSimilarListings } from "@/lib/similar-listings";
import { ListingCard } from "@/components/search/ListingCard";
import { parseHorairesSemaine, isOpenNow } from "@/lib/horaires-semaine";

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
    include: { brand: true, model: true },
  });
  if (!listing || listing.status !== "PUBLIEE") return {};

  const brandLabel = listing.brand?.name ?? listing.brandFreeText ?? "";
  const modelLabel = listing.model?.name ?? listing.modelFreeText ?? "";
  const title = `${listing.title} — ${brandLabel} ${modelLabel} ${listing.year}`.trim();
  const canonical = `${SITE_URL}/${locale}/annonce/${listing.id}`;
  return {
    title: `${title} — Souq Auto`,
    description: listing.description.slice(0, 160),
    alternates: { canonical },
    // Lot 142 — PAS d'`images` ici : elle l'emporterait sur le fichier `opengraph-image.tsx` voisin (la carte de partage avec prix
    // et caractéristiques) et on partagerait de nouveau la photo brute du vendeur, sans dimensions déclarées.
    openGraph: {
      title,
      description: listing.description.slice(0, 160),
      url: canonical,
      type: "website",
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
  // Lot 131 — vraie réponse 404 (et non une page « introuvable » servie en 200, que les moteurs de recherche
  // gardent en mémoire) : même réponse pour une annonce inexistante et pour une annonce non publique d'un autre vendeur.
  if (!listing || (listing.status !== "PUBLIEE" && !isOwner)) notFound();

  // Lot 122 — ni le vendeur, ni les robots (indexation, aperçus de liens, supervision) : leurs passages
  // fausseraient les vues et le taux de contact des statistiques. Compté après l'envoi de la page.
  if (!isOwner && !isLikelyBot((await headers()).get("user-agent"))) {
    const listingId = listing.id;
    after(() => recordListingView(listingId));
  }

  // Lot 126 — guide d'achat de ce modèle, s'il en existe un de paru. Lot 144 — à défaut, le guide GÉNÉRAL (« acheter une voiture
  // d'occasion »), s'il en existe un de paru : la plupart des modèles n'auront jamais de guide propre, et l'acheteur qui hésite devant
  // une annonce est précisément celui à qui il sert. Le guide du modèle passe toujours avant.
  const guideSelect = { slug: true, titleFr: true, titleAr: true } as const;
  const modelGuide =
    (listing.modelId
      ? await prisma.blogArticle.findFirst({
          where: { kind: "GUIDE", ...publishedNow(new Date()), guide: { modelId: listing.modelId } },
          orderBy: { publishedAt: "desc" },
          select: guideSelect,
        })
      : null) ??
    (await prisma.blogArticle.findFirst({
      where: { kind: "GUIDE", ...publishedNow(new Date()), guide: { modelId: null } },
      orderBy: { publishedAt: "desc" },
      select: guideSelect,
    }));

  const similarListings = await getSimilarListings({
    excludeId: listing.id,
    brandId: listing.brandId,
    modelId: listing.modelId,
    price: listing.price,
  });

  // Lot 158 — encart pro : statut ouverture + compteur stock actif
  const proAccount = listing.seller.professionalAccount;
  const proSchedule = proAccount ? parseHorairesSemaine(proAccount.horairesSemaine) : null;
  const proOpenNow = proSchedule ? isOpenNow(proSchedule) : null;
  const proActiveListingCount = proAccount
    ? await prisma.listing.count({ where: { sellerId: listing.sellerId, status: "PUBLIEE" } })
    : 0;

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
  // Lot 141 — les signaux de confiance, ici, à l'endroit exact où l'acheteur décide de contacter.
  const sellerResponsiveness = await getSellerResponsiveness(listing.sellerId);

  const listingUrl = `${SITE_URL}/${locale}/annonce/${listing.id}`;
  const vehicleJsonLd = buildVehicleJsonLd({
    title: listing.title,
    description: listing.description,
    url: listingUrl,
    images: listing.photos.map((p) => resolveAbsolutePhotoUrl(p.path)),
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
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(vehicleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }}
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
            <p className="text-xs text-slate-500">
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

      <PhotoGallery photos={listing.photos} alt={listing.title} />
      <PhotoCredits credits={collectPhotoCredits(listing.photos)} />

      <div className="grid sm:grid-cols-3 gap-8">
        <div className="sm:col-span-2">
          <h1 className="text-2xl font-semibold text-slate-900 text-balance">{listing.title}</h1>
          <p className="mt-1 text-slate-500">
            {brandLabel} {modelLabel} · {tListing("yearLabel", { value: listing.year })} ·{" "}
            {tListing("mileageUnit", { value: listing.mileage.toLocaleString() })}
          </p>

          {modelGuide && (
            <Link
              href={`/guides/${modelGuide.slug}`}
              className="mt-4 block rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 hover:border-emerald-300"
            >
              <span className="font-medium">{tListing("buyingGuideLabel")}</span>{" "}
              <span className="underline">{locale === "ar" ? modelGuide.titleAr : modelGuide.titleFr}</span>
            </Link>
          )}

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
              <p className="mt-2 text-xs text-slate-500">{tEstimate("disclaimer")}</p>
            </div>
          )}

          {/* Lot 149 — simulateur de crédit */}
          <CreditCalculator price={listing.price} />

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
              <p className="text-xs text-slate-500 mb-1">{tListing("seller")}</p>
              <Link href={`/vendeur/${listing.sellerId}`} className="font-medium text-slate-900 hover:underline">
                {listing.seller.profile?.displayName ?? listing.seller.email}
              </Link>
              {sellerRating.count > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">
                  {"★".repeat(Math.round(sellerRating.average))}{" "}
                  {tReview("averageRating", { average: sellerRating.average, count: sellerRating.count })}
                </p>
              )}
              <SellerTrustBadges
                identityVerified={Boolean(listing.seller.identityVerifiedAt)}
                proVerified={listing.seller.professionalAccount?.badgeVerifie}
                responsiveness={sellerResponsiveness}
                className="mt-1.5"
              />
              {proAccount && (
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-900">{proAccount.nomCommercial}</span>
                    {proAccount.badgeVerifie && (
                      <span className="text-xs font-medium text-emerald-700">✓</span>
                    )}
                  </div>
                  {proAccount.categoryPro && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {tPro(`categoryPro_${proAccount.categoryPro}`)}
                    </p>
                  )}
                  {proOpenNow !== null && (
                    <p className={`text-xs mt-1 font-medium ${proOpenNow ? "text-emerald-700" : "text-slate-400"}`}>
                      {proOpenNow ? tPro("openNow") : tPro("closedNow")}
                    </p>
                  )}
                  <Link
                    href={`/pro/${proAccount.id}`}
                    className="mt-2 inline-block text-xs text-slate-700 hover:underline"
                  >
                    {tPro("proEncartViewAll", { count: proActiveListingCount })}
                  </Link>
                </div>
              )}
            </div>

            {!isOwner && (
              <div className="mt-4 space-y-2">
                <ContactSellerButton listingId={listing.id} listingTitle={listing.title} isLoggedIn={Boolean(currentUser)} />
                {/* Lot 119 — le numéro n'est JAMAIS envoyé avec la page : seul le fait qu'il existe
                    (et le choix WhatsApp du vendeur) est transmis ; le numéro est demandé au clic. */}
                {listing.seller.phone && (
                  <ContactButtons listingId={listing.id} whatsappEnabled={listing.seller.whatsappEnabled} />
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

      {/* Lot 151 — tracker (invisible) + section "Récemment consultés" */}
      <RecentlyViewedTracker
        entry={{
          id: listing.id,
          title: listing.title,
          price: listing.price,
          photo: listing.photos[0]?.path ?? null,
          brandLabel,
          modelLabel,
          year: listing.year,
          wilayaNomFr: listing.wilaya.nomFr,
          wilayaNomAr: listing.wilaya.nomAr,
          viewedAt: 0,
        }}
      />
      <RecentlyViewedSection excludeId={listing.id} />

      {/* Lot 152 — annonces similaires (même modèle puis même marque/fourchette) */}
      {similarListings.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-slate-700 mb-3">{tListing("similarTitle")}</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
            {similarListings.map((similar, index) => (
              <div key={similar.id} className="snap-start shrink-0 w-56">
                <ListingCard
                  listing={similar}
                  isLoggedIn={Boolean(currentUser)}
                  isFavorited={false}
                  eager={index === 0}
                />
              </div>
            ))}
          </div>
        </section>
      )}
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
