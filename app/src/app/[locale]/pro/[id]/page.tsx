import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { SITE_URL, resolveAbsolutePhotoUrl } from "@/lib/site";
import { buildAutoDealerJsonLd, buildBreadcrumbJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { buildShowcaseDescription, isShowcaseIndexable } from "@/lib/pro-showcase-seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { ListingCard } from "@/components/search/ListingCard";
import { estimatePricesForListings } from "@/lib/price-estimation";
import { Pagination } from "@/components/search/Pagination";
import { pageWindow, parseRequestedPage } from "@/lib/pagination";
import { PAGE_SIZE } from "@/lib/validation/search";
import { computePriceBadge } from "@/lib/price-badge";
import { computeAverageRating } from "@/lib/reviews";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewReplyForm } from "@/components/ReviewReplyForm";
import { DeleteReviewButton } from "@/components/admin/DeleteReviewButton";
import { isStaff } from "@/lib/auth-server/roles";
import { canReplyToProReviews } from "@/lib/pro-account";
import { parseProPermissions } from "@/lib/pro-permissions";

// Lot 108 — SEO de la vitrine : métadonnées, image de partage (bannière, à
// défaut le logo), et noindex tant que le compte n'a aucune annonce publiée.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  const account = await prisma.professionalAccount.findUnique({ where: { id }, include: { wilaya: true } });
  if (!account) return {};

  const t = await getTranslations({ locale, namespace: "Pro" });
  const publishedCount = await prisma.listing.count({ where: { sellerId: account.userId, status: "PUBLIEE" } });
  const wilayaLabel = account.wilaya ? (locale === "ar" ? account.wilaya.nomAr : account.wilaya.nomFr) : null;

  const title = wilayaLabel ? `${account.nomCommercial} — ${wilayaLabel}` : account.nomCommercial;
  const description =
    buildShowcaseDescription(account.presentation) ??
    (wilayaLabel
      ? t("showcaseMetaDescriptionWilaya", { name: account.nomCommercial, wilaya: wilayaLabel })
      : t("showcaseMetaDescription", { name: account.nomCommercial }));
  const canonical = `${SITE_URL}/${locale}/pro/${account.id}`;
  const image = account.bannerUrl ?? account.logoUrl;

  return {
    title: `${title} — Souq Auto`,
    description,
    alternates: { canonical },
    ...(isShowcaseIndexable(publishedCount) ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: image ? [resolveAbsolutePhotoUrl(image)] : undefined,
    },
  };
}

export default async function ProShowcasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("Pro");
  const tReview = await getTranslations("Review");
  const tDirectory = await getTranslations("ProDirectory");

  const [account, currentUser] = await Promise.all([
    prisma.professionalAccount.findUnique({ where: { id }, include: { wilaya: true } }),
    getCurrentUser(),
  ]);

  // Un vrai 404 (et non une page 200 avec un message) : un « soft 404 » serait
  // indexé comme une page valide.
  if (!account) notFound();

  // Lot 137 — annonces paginées (20 par page) : un concessionnaire en publie des milliers, la vitrine les chargeait toutes.
  const publishedTotal = await prisma.listing.count({ where: { sellerId: account.userId, status: "PUBLIEE" } });
  const { page, totalPages: pages, skip } = pageWindow(publishedTotal, parseRequestedPage((await searchParams).page), PAGE_SIZE);

  const [listings, reviews] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId: account.userId, status: "PUBLIEE" },
      orderBy: { publishedAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        brand: true,
        model: true,
        wilaya: true,
        commune: true,
        photos: { orderBy: { position: "asc" }, take: 1 },
        equipments: { select: { equipmentId: true } },
      },
    }),
    prisma.review.findMany({
      where: { professionalAccountId: id },
      orderBy: { createdAt: "desc" },
      include: { author: { include: { profile: true } } },
    }),
  ]);

  const { average, count } = computeAverageRating(reviews.map((r) => r.rating));

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

  const estimates = await estimatePricesForListings(
    listings.map((l) => ({ ...l, equipmentIds: l.equipments.map((e) => e.equipmentId) }))
  );
  const priceBadges = new Map(
    listings.map((listing) => {
      const estimate = estimates.get(listing.id);
      return [listing.id, estimate ? computePriceBadge(listing.price, estimate.mid, estimate.sampleSize) : null];
    })
  );

  let canReview = false;
  let alreadyReviewed = false;
  let canReply = false;
  if (currentUser) {
    if (currentUser.id === account.userId) {
      canReply = true;
    } else {
      const [interactionCount, existingReview, collaboration] = await Promise.all([
        prisma.conversation.count({ where: { buyerId: currentUser.id, sellerId: account.userId } }),
        prisma.review.findUnique({
          where: { professionalAccountId_authorId: { professionalAccountId: id, authorId: currentUser.id } },
        }),
        prisma.proCollaborator.findUnique({
          where: { professionalAccountId_userId: { professionalAccountId: id, userId: currentUser.id } },
        }),
      ]);
      alreadyReviewed = Boolean(existingReview);
      canReview = interactionCount > 0 && !alreadyReviewed && !collaboration;
      canReply = canReplyToProReviews({
        isOwner: false,
        permissions: collaboration ? parseProPermissions(collaboration.permissions) : null,
      });
    }
  }

  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "medium" });
  const wilayaLabel = account.wilaya ? (locale === "ar" ? account.wilaya.nomAr : account.wilaya.nomFr) : null;

  const showcaseUrl = `${SITE_URL}/${locale}/pro/${account.id}`;
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: tDirectory("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: tDirectory("title"), url: `${SITE_URL}/${locale}/concessionnaires` },
    { name: account.nomCommercial, url: showcaseUrl },
  ]);
  const dealerJsonLd = buildAutoDealerJsonLd({
    name: account.nomCommercial,
    url: showcaseUrl,
    description: buildShowcaseDescription(account.presentation),
    image: account.logoUrl ? resolveAbsolutePhotoUrl(account.logoUrl) : undefined,
    region: wilayaLabel ?? undefined,
    ratingAverage: average,
    ratingCount: count,
  });

  return (
    <div>
      {account.bannerUrl && (
        <div className="relative h-40 sm:h-56 w-full">
          <Image src={account.bannerUrl} alt="" fill sizes="100vw" className="object-cover" loading="eager" fetchPriority="high" />
        </div>
      )}
      <div className="mx-auto max-w-4xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(dealerJsonLd) }} />
      <Breadcrumbs
        items={[
          { name: tDirectory("breadcrumbHome"), href: "/" },
          { name: tDirectory("title"), href: "/concessionnaires" },
          { name: account.nomCommercial },
        ]}
      />
      <div className="flex items-center gap-3">
        {account.logoUrl && (
          <div className="relative h-14 w-14 shrink-0">
            <Image
              src={account.logoUrl}
              alt=""
              fill
              sizes="56px"
              className="rounded-full object-cover border border-slate-200"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">{account.nomCommercial}</h1>
          {account.badgeVerifie && <span className="text-emerald-700 text-sm">{t("verifiedBadge")}</span>}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
        {account.categoryPro && <span>{t(`categoryPro_${account.categoryPro}`)}</span>}
        {wilayaLabel && <span>{wilayaLabel}</span>}
        {account.horaires && <span>{account.horaires}</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {account.phone && (
          <a
            href={`tel:${account.phone}`}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 text-slate-400">
              <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 0 1 3.5 2h1.148a1.5 1.5 0 0 1 1.465 1.175l.716 3.223a1.5 1.5 0 0 1-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 0 0 6.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 0 1 1.767-1.052l3.223.716A1.5 1.5 0 0 1 18 15.352V16.5a1.5 1.5 0 0 1-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 0 1 2.43 8.326 13.019 13.019 0 0 1 2 5V3.5Z" clipRule="evenodd" />
            </svg>
            {account.phone}
          </a>
        )}
        {account.website && (
          <a
            href={account.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 text-slate-400">
              <path d="M10 1a9 9 0 1 0 0 18A9 9 0 0 0 10 1Zm-.75 13.89a7.5 7.5 0 0 1-5.678-9.825C4.08 7.47 5.636 9 7.5 9h.25v.75A1.75 1.75 0 0 0 9.5 11.5h.25v2.89a.75.75 0 0 1-.5.5Zm5.474-2.4A7.48 7.48 0 0 1 12.5 14v-.5A1.5 1.5 0 0 0 11 12h-.5v-1a.75.75 0 0 0-.75-.75H8a.75.75 0 0 0 0 1.5h.75V13H8a.25.25 0 0 1-.25-.25V9A.75.75 0 0 0 7 8.25H5.37A7.5 7.5 0 0 1 14.724 12.49Z" />
            </svg>
            {t("websiteLink")}
          </a>
        )}
      </div>
      {account.presentation && <p className="text-sm text-slate-700 mt-4 whitespace-pre-wrap">{account.presentation}</p>}

      <p className="mt-4 text-sm">
        {count > 0 ? (
          <span className="text-amber-600 font-medium">
            {"★".repeat(Math.round(average))} {tReview("averageRating", { average, count })}
          </span>
        ) : (
          <span className="text-slate-500">{tReview("noReviews")}</span>
        )}
      </p>

      <Link
        href={`/vendeur/${account.userId}`}
        className="inline-block mt-2 text-sm text-slate-500 hover:underline"
      >
        {t("viewIndividualReputation")}
      </Link>

      <div className="grid sm:grid-cols-3 gap-8 mt-8">
        <div className="sm:col-span-2">
          <h2 className="text-lg font-medium text-slate-900 mb-3">{t("listingsTitle")}</h2>
          {listings.length === 0 ? (
            <p className="text-slate-500 text-sm">{t("noListings")}</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {listings.map((listing, index) => (
                <ListingCard
                  eager={index < 2}
                  key={listing.id}
                  listing={listing}
                  isLoggedIn={Boolean(currentUser)}
                  isFavorited={favoriteIds.has(listing.id)}
                  priceBadge={priceBadges.get(listing.id)}
                />
              ))}
            </div>
          )}
          <Pagination page={page} totalPages={pages} searchParams={{}} basePath={`/pro/${id}`} />
        </div>

        <div className="sm:col-span-1 space-y-4">
          {canReview && <ReviewForm endpoint={`/api/pro/accounts/${id}/reviews`} />}
          {alreadyReviewed && <p className="text-sm text-slate-500">{tReview("alreadyReviewed")}</p>}

          <div>
            <h2 className="text-lg font-medium text-slate-900 mb-3">{t("companyReviewsTitle")}</h2>
            {reviews.length === 0 ? (
              <p className="text-slate-500 text-sm">{tReview("noReviews")}</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-amber-600 text-sm">
                        {"★".repeat(review.rating)}
                        {"☆".repeat(5 - review.rating)}
                      </p>
                      {currentUser && isStaff(currentUser.role) && <DeleteReviewButton reviewId={review.id} />}
                    </div>
                    {review.comment && <p className="text-sm text-slate-700 mt-1">{review.comment}</p>}
                    <p className="text-xs text-slate-500 mt-1">
                      {tReview("byAuthor", {
                        name: review.author.profile?.displayName ?? review.author.email,
                      })}{" "}
                      · {dateFormatter.format(review.createdAt)}
                    </p>
                    <ReviewReplyForm reviewId={review.id} initialReply={review.reply} canReply={canReply} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
