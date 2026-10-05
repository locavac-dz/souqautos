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
import { throttledSweep } from "@/lib/sweeper-throttle";
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
import { localizedAlternates } from "@/lib/seo-alternates";
import { buildVehicleJsonLd, buildBreadcrumbJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { IslamicFinancingSimulator } from "@/components/IslamicFinancingSimulator";
import { RecentlyViewedTracker } from "@/components/RecentlyViewedTracker";
import { PhotoGallery } from "@/components/PhotoGallery";
import { RecentlyViewedSection } from "@/components/RecentlyViewedSection";
import { getSimilarListings } from "@/lib/similar-listings";
import { getAlternativeListings } from "@/lib/similar-ai";
import { ListingCard } from "@/components/search/ListingCard";
import { parseHorairesSemaine, isOpenNow } from "@/lib/horaires-semaine";
import { CallbackRequestButton } from "@/components/CallbackRequestButton";
import { MakeOfferButton } from "@/components/MakeOfferButton";
import { MarketStatsWidget } from "@/components/MarketStatsWidget";
import { formatNumber } from "@/lib/format";

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
const BODY_TYPE_KEY: Record<string, string> = {
  BERLINE: "bodyTypeBerline",
  SUV: "bodyTypeSuv",
  BREAK: "bodyTypeBreak",
  CITADINE: "bodyTypeCitadine",
  COUPE: "bodyTypeCoupe",
  CABRIOLET: "bodyTypeCabriolet",
  MONOSPACE: "bodyTypeMonospace",
  PICKUP: "bodyTypePickup",
  FOURGON: "bodyTypeFourgon",
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
    alternates: localizedAlternates(canonical),
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

  // Lot 213 — throttle 30 s : évite de relancer les sweepers à chaque vue
  await Promise.all([
    throttledSweep("auto-renewals", sweepAutoRenewals),
    throttledSweep("expired-listings", sweepExpiredListings),
    throttledSweep("expiry-reminders", sweepExpiringListingsForReminders),
  ]);

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

  const [similarListings, alternativeListings] = await Promise.all([
    getSimilarListings({
      excludeId: listing.id,
      brandId: listing.brandId,
      modelId: listing.modelId,
      price: listing.price,
    }),
    // Lot 250 — recommandations inter-marques via Claude (même segment, autre marque).
    // Silencieux si ANTHROPIC_API_KEY absent ou Claude indisponible.
    getAlternativeListings({
      excludeId: listing.id,
      brandId: listing.brandId,
      modelId: listing.modelId,
      price: listing.price,
    }),
  ]);

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

  const hasPendingOffer =
    currentUser && !isOwner
      ? Boolean(
          await prisma.offer.findFirst({
            where: { listingId: listing.id, buyerId: currentUser.id, status: "PENDING" },
            select: { id: true },
          })
        )
      : false;

  const tReview = await getTranslations("Review");
  const tPro = await getTranslations("Pro");
  const sellerReviews = await prisma.review.findMany({
    where: { sellerId: listing.sellerId, status: "APPROVED" },
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
    ...(listing.brand ? [{ name: listing.brand.name, href: `/voitures/${listing.brand.slug}`, lang: "fr" }] : []),
    ...(listing.brand && listing.model
      ? [{ name: listing.model.name, href: `/voitures/${listing.brand.slug}/${listing.model.slug}`, lang: "fr" }]
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
          <p className="font-medium text-emerald-800 dark:text-emerald-400">{tListing("successTitle")}</p>
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{tListing("successBody")}</p>
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
                  className="text-xs text-slate-500 dark:text-slate-400 underline hover:text-slate-700 dark:hover:text-slate-300"
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
            <p className="text-xs text-slate-500 dark:text-slate-400">
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
                className="text-xs text-slate-500 dark:text-slate-400 underline hover:text-slate-700 dark:hover:text-slate-200"
              >
                {tListing("editListingAction")}
              </Link>
            )}
          </div>
        </div>
      )}

      <PhotoGallery photos={listing.photos.map((p) => ({ id: p.id, path: p.path }))} alt={listing.title} />
      <PhotoCredits credits={collectPhotoCredits(listing.photos)} />

      <div className="grid sm:grid-cols-3 gap-8">
        <div className="sm:col-span-2">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 text-balance">{listing.title}</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            <span lang="fr">{brandLabel} {modelLabel}</span> · {tListing("yearLabel", { value: listing.year })} ·{" "}
            {tListing("mileageUnit", { value: formatNumber(listing.mileage, locale) })}
          </p>

          {modelGuide && (
            <Link
              href={`/guides/${modelGuide.slug}`}
              className="mt-4 block rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 p-3 text-sm text-emerald-900 dark:text-emerald-200 hover:border-emerald-300 dark:hover:border-emerald-700"
            >
              <span className="font-medium">{tListing("buyingGuideLabel")}</span>{" "}
              <span className="underline">{locale === "ar" ? modelGuide.titleAr : modelGuide.titleFr}</span>
            </Link>
          )}

          <div className="mt-6">
            <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{tListing("descriptionTitle")}</h2>
            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{listing.description}</p>
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{tListing("detailsTitle")}</h2>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 text-sm">
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
              {listing.powerHp && <DetailRow label={tWizard("powerHp")} value={`${listing.powerHp} ${tWizard("powerHpUnit")}`} />}
              {listing.fiscalPower && <DetailRow label={tWizard("fiscalPower")} value={`${listing.fiscalPower} ${tWizard("fiscalPowerUnit")}`} />}
              {listing.bodyType && <DetailRow label={tWizard("bodyType")} value={tWizard(BODY_TYPE_KEY[listing.bodyType])} />}
              {listing.negotiable && <DetailRow label={tWizard("negotiable")} value="✓" />}
              {listing.controltechniqueExpiry && (
                <DetailRow
                  label={tListing("controltechniqueExpiry")}
                  value={new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "long" }).format(listing.controltechniqueExpiry)}
                />
              )}
              {listing.assuranceExpiry && (
                <DetailRow
                  label={tListing("assuranceExpiry")}
                  value={new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "long" }).format(listing.assuranceExpiry)}
                />
              )}
            </div>
          </div>

          {listing.equipments.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{tListing("equipmentsTitle")}</h2>
              <div className="flex flex-wrap gap-2">
                {listing.equipments.map(({ equipment }) => (
                  <span
                    key={equipment.id}
                    className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs text-slate-700 dark:text-slate-300"
                  >
                    {locale === "ar" ? equipment.nameAr : equipment.nameFr}
                  </span>
                ))}
              </div>
            </div>
          )}

          {estimate && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{tPriceBadge("estimationTitle")}</h2>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                <DetailRow label={tPriceBadge("priceRequested")} value={`${formatNumber(listing.price, locale)} DA`} />
                <DetailRow label={tPriceBadge("priceMarket")} value={`${formatNumber(estimate.mid, locale)} DA`} />
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
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{tEstimate("disclaimer")}</p>
            </div>
          )}

          {/* Lot 253 — simulateur de financement islamique (Murābaha) */}
          <IslamicFinancingSimulator price={listing.price} />

          {listing.priceHistory.length > 1 && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{tListing("priceHistoryTitle")}</h2>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {listing.priceHistory.map((entry) => (
                  <DetailRow
                    key={entry.id}
                    label={new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
                      dateStyle: "long",
                    }).format(entry.recordedAt)}
                    value={`${formatNumber(entry.price, locale)} DA`}
                  />
                ))}
              </div>
            </div>
          )}

          {listing.renewals.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{tListing("renewalHistoryTitle")}</h2>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 text-sm">
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
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {formatNumber(listing.price, locale)} DA
              </p>
              <div className="flex gap-4 shrink-0">
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
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{locationLabel}</p>

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

            {/* Lot 172 — encart statistiques de marché par modèle + année */}
            {listing.brandId && listing.modelId && listing.brand && listing.model && (
              <MarketStatsWidget
                brandId={listing.brandId}
                modelId={listing.modelId}
                year={listing.year}
                listingPrice={listing.price}
                brandName={brandLabel}
                modelName={modelLabel}
                brandSlug={listing.brand.slug}
                modelSlug={listing.model.slug}
              />
            )}

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{tListing("seller")}</p>
              <Link href={`/vendeur/${listing.sellerId}`} className="font-medium text-slate-900 dark:text-slate-100 hover:underline">
                {listing.seller.profile?.displayName ?? listing.seller.email}
              </Link>
              {sellerRating.count > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">
                  {"★".repeat(Math.round(sellerRating.average))}{" "}
                  {tReview("averageRating", { average: sellerRating.average, count: sellerRating.count })}
                </p>
              )}
              {/* Lot 165 — CTA avis : visible pour les acheteurs connectés uniquement */}
              {currentUser && !isOwner && (
                <Link
                  href={`/vendeur/${listing.sellerId}#donner-avis`}
                  className="mt-1 inline-block text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:underline"
                >
                  {tReview("leaveReview")}
                  <span aria-hidden="true" className="rtl:hidden"> →</span>
                  <span aria-hidden="true" className="ltr:hidden"> ←</span>
                </Link>
              )}
              <SellerTrustBadges
                identityVerified={Boolean(listing.seller.identityVerifiedAt)}
                proVerified={listing.seller.professionalAccount?.badgeVerifie}
                responsiveness={sellerResponsiveness}
                className="mt-1.5"
              />
              {proAccount && (
                <div className="mt-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{proAccount.nomCommercial}</span>
                    {proAccount.badgeVerifie && (
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">✓</span>
                    )}
                  </div>
                  {proAccount.categoryPro && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {tPro(`categoryPro_${proAccount.categoryPro}`)}
                    </p>
                  )}
                  {proOpenNow !== null && (
                    <p className={`text-xs mt-1 font-medium ${proOpenNow ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400"}`}>
                      {proOpenNow ? tPro("openNow") : tPro("closedNow")}
                    </p>
                  )}
                  <Link
                    href={`/pro/${proAccount.id}`}
                    className="mt-2 inline-flex items-center py-1 text-xs text-slate-700 dark:text-slate-300 hover:underline"
                  >
                    {tPro("proEncartViewAll", { count: proActiveListingCount })}
                  </Link>
                </div>
              )}
            </div>

            {!isOwner && (
              <div className="mt-4 space-y-2">
                <ContactSellerButton listingId={listing.id} listingTitle={listing.title} isLoggedIn={Boolean(currentUser)} />
                <MakeOfferButton listingId={listing.id} listingPrice={listing.price} isLoggedIn={Boolean(currentUser)} hasPendingOffer={hasPendingOffer} />
                {/* Lot 160 — demande de rappel, uniquement pour les annonces pro */}
                {proAccount && <CallbackRequestButton listingId={listing.id} />}
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

            {/* Partager l'annonce via WhatsApp — disponible pour tous (acheteur et vendeur) */}
            <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-4">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${listing.title} — ${formatNumber(listing.price, locale)} DA\n${SITE_URL}/${locale}/annonce/${listing.id}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-md border border-green-700 dark:border-green-400 px-4 py-2.5 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-700/5 dark:hover:bg-green-400/10 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                {tListing("shareViaWhatsApp")}
              </a>
            </div>
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
        <section className="mt-10" aria-labelledby="similar-listings-heading">
          <h2 id="similar-listings-heading" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{tListing("similarTitle")}</h2>
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

      {/* Lot 250 — recommandations inter-marques : même segment, autres marques */}
      {alternativeListings.length > 0 && (
        <section className="mt-10" aria-labelledby="alt-listings-heading">
          <h2 id="alt-listings-heading" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{tListing("alternativesTitle")}</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
            {alternativeListings.map((alt) => (
              <div key={alt.id} className="snap-start shrink-0 w-56">
                <ListingCard
                  listing={alt}
                  isLoggedIn={Boolean(currentUser)}
                  isFavorited={false}
                  eager={false}
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
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-slate-900 dark:text-slate-100 font-medium text-right">{value}</span>
    </div>
  );
}
