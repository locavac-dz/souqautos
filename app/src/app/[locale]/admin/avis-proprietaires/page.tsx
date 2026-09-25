import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { OwnerReviewModerationActions } from "@/components/admin/OwnerReviewModerationActions";

// Lot 116 — file de validation des avis de propriétaires (MODERATEUR et ADMIN :
// l'accès est déjà limité au personnel par le layout de /admin).
export default async function AdminOwnerReviewsPage() {
  const locale = await getLocale();
  const t = await getTranslations("AdminOwnerReview");

  const reviews = await prisma.ownerReview.findMany({
    where: { status: "EN_ATTENTE" },
    orderBy: { createdAt: "asc" },
    include: {
      user: { include: { profile: true } },
      model: { include: { brand: true } },
    },
  });

  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "medium" });
  const numberLocale = locale === "ar" ? "ar-DZ" : "fr-DZ";

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">
        {t("title")} ({reviews.length})
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t("subtitle")}</p>

      {reviews.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t("empty")}</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="flex gap-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex-1">
                <Link
                  href={`/voitures/${review.model.brand.slug}/${review.model.slug}`}
                  className="font-medium text-slate-900 dark:text-slate-100 hover:underline"
                >
                  {review.model.brand.name} {review.model.name}
                </Link>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  {t("ratingLine", { rating: review.rating })}
                  {review.purchaseYear && ` · ${t("purchaseYear", { year: review.purchaseYear })}`}
                  {review.mileageKm !== null && ` · ${review.mileageKm.toLocaleString(numberLocale)} km`}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300" dir="auto">
                  {review.comment}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {review.user.profile?.displayName ?? review.user.email} · {dateFormatter.format(review.createdAt)}
                </p>
              </div>
              <div className="w-64 shrink-0">
                <OwnerReviewModerationActions reviewId={review.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
