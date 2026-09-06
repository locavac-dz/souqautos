import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { ListingCard } from "@/components/search/ListingCard";
import { estimatePricesForListings } from "@/lib/price-estimation";
import { computePriceBadge } from "@/lib/price-badge";
import { computeAverageRating } from "@/lib/reviews";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewReplyForm } from "@/components/ReviewReplyForm";
import { DeleteReviewButton } from "@/components/admin/DeleteReviewButton";
import { isStaff } from "@/lib/auth-server/roles";
import { canReplyToProReviews } from "@/lib/pro-account";
import { parseProPermissions } from "@/lib/pro-permissions";

export default async function ProShowcasePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("Pro");
  const tReview = await getTranslations("Review");

  const [account, currentUser] = await Promise.all([
    prisma.professionalAccount.findUnique({ where: { id }, include: { wilaya: true } }),
    getCurrentUser(),
  ]);

  if (!account) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-slate-600">{t("showcaseNotFound")}</p>
      </div>
    );
  }

  const [listings, reviews] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId: account.userId, status: "PUBLIEE" },
      orderBy: { publishedAt: "desc" },
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">{account.nomCommercial}</h1>
        {account.badgeVerifie && <span className="text-emerald-700 text-sm">{t("verifiedBadge")}</span>}
      </div>
      {wilayaLabel && <p className="text-sm text-slate-500 mt-1">{wilayaLabel}</p>}
      {account.horaires && <p className="text-sm text-slate-500 mt-1">{account.horaires}</p>}
      {account.presentation && <p className="text-sm text-slate-700 mt-4 whitespace-pre-wrap">{account.presentation}</p>}

      <p className="mt-4 text-sm">
        {count > 0 ? (
          <span className="text-amber-600 font-medium">
            {"★".repeat(Math.round(average))} {tReview("averageRating", { average, count })}
          </span>
        ) : (
          <span className="text-slate-400">{tReview("noReviews")}</span>
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
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isLoggedIn={Boolean(currentUser)}
                  isFavorited={favoriteIds.has(listing.id)}
                  priceBadge={priceBadges.get(listing.id)}
                />
              ))}
            </div>
          )}
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
                    <p className="text-xs text-slate-400 mt-1">
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
  );
}
