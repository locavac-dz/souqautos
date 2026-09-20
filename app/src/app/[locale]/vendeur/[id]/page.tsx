import { notFound } from "next/navigation";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { getSellerTrustSummary } from "@/lib/seller-trust";
import { getSellerResponsiveness } from "@/lib/seller-responsiveness-service";
import { SellerTrustBadges } from "@/components/SellerTrustBadges";
import { ListingCard } from "@/components/search/ListingCard";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewReplyForm } from "@/components/ReviewReplyForm";
import { DeleteReviewButton } from "@/components/admin/DeleteReviewButton";
import { TrustScoreCard } from "@/components/TrustScoreCard";
import { isStaff } from "@/lib/auth-server/roles";
import { estimatePricesForListings } from "@/lib/price-estimation";
import { Pagination } from "@/components/search/Pagination";
import { pageWindow, parseRequestedPage } from "@/lib/pagination";
import { PAGE_SIZE } from "@/lib/validation/search";
import { computePriceBadge } from "@/lib/price-badge";
import { ReportUserButton } from "@/components/ReportUserButton";

export default async function SellerPage({ params, searchParams }: { params: Promise<{ id: string; locale: string }>; searchParams: Promise<{ page?: string | string[] }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("Review");
  const tVerification = await getTranslations("Verification");

  const [seller, currentUser] = await Promise.all([
    prisma.user.findUnique({ where: { id }, include: { profile: true } }),
    getCurrentUser(),
  ]);

  // Lot 131 — vraie réponse 404 pour un profil inexistant.
  if (!seller) notFound();

  // Lot 137 — les annonces sont paginées (20 par page) : un gros vendeur en a des milliers, et la page les chargeait toutes
  // (1,2 Mo de HTML, 1,8 s à 10 visiteurs simultanés).
  const publishedTotal = await prisma.listing.count({ where: { sellerId: id, status: "PUBLIEE" } });
  const { page, totalPages: pages, skip } = pageWindow(publishedTotal, parseRequestedPage((await searchParams).page), PAGE_SIZE);

  // Lot 141 — réactivité mesurée sur les vraies conversations (badge positif seulement).
  const [reviews, listings, trust, responsiveness] = await Promise.all([
    prisma.review.findMany({
      where: { sellerId: id },
      orderBy: { createdAt: "desc" },
      include: { author: { include: { profile: true } } },
    }),
    prisma.listing.findMany({
      where: { sellerId: id, status: "PUBLIEE" },
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
    getSellerTrustSummary(id),
    getSellerResponsiveness(id),
  ]);

  // trust ne peut être null ici : seller a déjà été vérifié non-null ci-dessus.
  const { trustBreakdown, averageRating: average, reviewCount: count, confirmedReportCount, accountAgeDays } =
    trust!;

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
  let alreadyReportedUser = false;
  if (currentUser && currentUser.id !== id) {
    const [interactionCount, existingReview, existingReport] = await Promise.all([
      prisma.conversation.count({ where: { buyerId: currentUser.id, sellerId: id } }),
      prisma.review.findUnique({ where: { sellerId_authorId: { sellerId: id, authorId: currentUser.id } } }),
      prisma.report.findUnique({
        where: { reportedUserId_authorId: { reportedUserId: id, authorId: currentUser.id } },
      }),
    ]);
    alreadyReviewed = Boolean(existingReview);
    canReview = interactionCount > 0 && !alreadyReviewed;
    alreadyReportedUser = Boolean(existingReport);
  }

  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "medium" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center gap-3">
        {seller.profile?.avatarUrl ? (
          <div className="relative h-14 w-14 shrink-0">
            <Image
              src={seller.profile.avatarUrl}
              alt=""
              fill
              sizes="56px"
              className="rounded-full object-cover border border-slate-200"
            />
          </div>
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-full bg-slate-100 border border-slate-200" />
        )}
        <h1 className="text-2xl font-semibold text-slate-900">
          {seller.profile?.displayName ?? seller.email}
        </h1>
      </div>
      <p className="text-sm text-slate-500 mt-1">
        {t("memberSince", { date: dateFormatter.format(seller.createdAt) })}
      </p>
      {(seller.emailVerifiedAt || seller.phoneVerifiedAt || seller.identityVerifiedAt) && (
        <p className="mt-1 flex flex-wrap gap-3 text-xs text-emerald-700">
          {seller.emailVerifiedAt && <span>{tVerification("emailVerifiedBadge")}</span>}
          {seller.phoneVerifiedAt && <span>{tVerification("phoneVerifiedBadge")}</span>}
          {seller.identityVerifiedAt && <span>{tVerification("identityVerifiedBadge")}</span>}
        </p>
      )}
      {/* Identité déjà affichée juste au-dessus avec les autres vérifications : ici, seulement la réactivité. */}
      <SellerTrustBadges identityVerified={false} responsiveness={responsiveness} className="mt-1" />
      <p className="mt-2 text-sm">
        {count > 0 ? (
          <span className="text-amber-600 font-medium">
            {"★".repeat(Math.round(average))} {t("averageRating", { average, count })}
          </span>
        ) : (
          <span className="text-slate-500">{t("noReviews")}</span>
        )}
      </p>

      {currentUser && currentUser.id !== id && (
        <div className="mt-2 text-right">
          <ReportUserButton
            userId={id}
            isLoggedIn={Boolean(currentUser)}
            initialAlreadyReported={alreadyReportedUser}
          />
        </div>
      )}

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
          <Pagination page={page} totalPages={pages} searchParams={{}} basePath={`/vendeur/${id}`} />
        </div>

        <div className="sm:col-span-1 space-y-4">
          <TrustScoreCard
            breakdown={trustBreakdown}
            reviewCount={count}
            confirmedReportCount={confirmedReportCount}
            accountAgeDays={accountAgeDays}
          />
          {canReview && <ReviewForm endpoint={`/api/users/${id}/reviews`} />}
          {alreadyReviewed && <p className="text-sm text-slate-500">{t("alreadyReviewed")}</p>}

          <div>
            <h2 className="text-lg font-medium text-slate-900 mb-3">{t("reviewsTitle")}</h2>
            {reviews.length === 0 ? (
              <p className="text-slate-500 text-sm">{t("noReviews")}</p>
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
                      {t("byAuthor", { name: review.author.profile?.displayName ?? review.author.email })} ·{" "}
                      {dateFormatter.format(review.createdAt)}
                    </p>
                    <ReviewReplyForm
                      reviewId={review.id}
                      initialReply={review.reply}
                      canReply={Boolean(currentUser && currentUser.id === id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
