import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { DeleteReviewButton } from "@/components/admin/DeleteReviewButton";
import { ModerateReviewButton } from "@/components/admin/ModerateReviewButton";

export default async function AdminReviewsPage() {
  const locale = await getLocale();
  const t = await getTranslations("Admin");
  const tReview = await getTranslations("Review");
  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "medium" });

  const [pending, reviews] = await Promise.all([
    prisma.review.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        seller: { include: { profile: true } },
        professionalAccount: true,
        author: { include: { profile: true } },
      },
    }),
    prisma.review.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        seller: { include: { profile: true } },
        professionalAccount: true,
        author: { include: { profile: true } },
      },
    }),
  ]);

  function ReviewRow({ review, showModerate }: { review: typeof pending[0]; showModerate: boolean }) {
    const statusBadge = review.status === "APPROVED"
      ? <span className="text-xs text-emerald-700 dark:text-emerald-400">{t("statusApproved")}</span>
      : review.status === "REJECTED"
      ? <span className="text-xs text-red-600 dark:text-red-400">{t("statusRejected")}</span>
      : null;

    return (
      <div key={review.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-amber-600 text-sm">
            {"★".repeat(review.rating)}
            {"☆".repeat(5 - review.rating)}
          </p>
          <div className="flex items-center gap-3">
            {statusBadge}
            {showModerate && (
              <>
                <ModerateReviewButton reviewId={review.id} action="APPROVED" />
                <ModerateReviewButton reviewId={review.id} action="REJECTED" />
              </>
            )}
            <DeleteReviewButton reviewId={review.id} />
          </div>
        </div>
        {review.comment && <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{review.comment}</p>}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {review.seller ? (
            <>
              {t("sellerLabel")}:{" "}
              <Link href={`/vendeur/${review.sellerId}`} className="hover:underline">
                {review.seller.profile?.displayName ?? review.seller.email}
              </Link>
            </>
          ) : (
            review.professionalAccount && (
              <>
                {t("proAccountLabel")}:{" "}
                <Link href={`/pro/${review.professionalAccountId}`} className="hover:underline">
                  {review.professionalAccount.nomCommercial}
                </Link>
              </>
            )
          )}{" "}
          · {tReview("byAuthor", { name: review.author.profile?.displayName ?? review.author.email })} ·{" "}
          {dateFormatter.format(review.createdAt)}
        </p>
      </div>
    );
  }

  return (
    <div>
      {pending.length > 0 && (
        <section className="mb-8">
          <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
            {t("pendingReviews")} ({pending.length})
          </h1>
          <div className="space-y-3">
            {pending.map((review) => (
              <ReviewRow key={review.id} review={review} showModerate={true} />
            ))}
          </div>
        </section>
      )}

      <section>
        {pending.length === 0 && (
          <h1 className="sr-only">{t("allReviews")}</h1>
        )}
        <h2 className={`font-medium text-slate-900 dark:text-slate-100 mb-4 ${pending.length > 0 ? "text-base" : "text-lg"}`}>
          {t("allReviews")} ({reviews.length})
        </h2>
        {reviews.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t("noReviewsYet")}</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <ReviewRow key={review.id} review={review} showModerate={false} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
