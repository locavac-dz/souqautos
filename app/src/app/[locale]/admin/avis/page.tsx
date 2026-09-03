import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { DeleteReviewButton } from "@/components/admin/DeleteReviewButton";

export default async function AdminReviewsPage() {
  const locale = await getLocale();
  const t = await getTranslations("Admin");
  const tReview = await getTranslations("Review");

  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      seller: { include: { profile: true } },
      professionalAccount: true,
      author: { include: { profile: true } },
    },
  });

  return (
    <div>
      <h2 className="text-lg font-medium text-slate-900 mb-4">
        {t("allReviews")} ({reviews.length})
      </h2>
      {reviews.length === 0 ? (
        <p className="text-slate-500 text-sm">{t("noReviewsYet")}</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <p className="text-amber-600 text-sm">
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                </p>
                <DeleteReviewButton reviewId={review.id} />
              </div>
              {review.comment && <p className="text-sm text-slate-700 mt-1">{review.comment}</p>}
              <p className="text-xs text-slate-400 mt-1">
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
                {new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "medium" }).format(
                  review.createdAt
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
