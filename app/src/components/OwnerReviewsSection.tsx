import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { StarRating } from "@/components/StarRating";
import { OwnerReviewForm } from "@/components/OwnerReviewForm";
import { ReportOwnerReviewButton } from "@/components/ReportOwnerReviewButton";
import { MIN_REVIEWS_FOR_AVERAGE, REVIEWS_PER_MODEL_PAGE, summarizeOwnerAggregate } from "@/lib/owner-review";
import { formatRating } from "@/lib/road-test";

// Lot 116 — avis de propriétaires sur la page d'un modèle. Ne montre que des
// avis PUBLIÉS (validés par l'équipe) ; l'auteur voit en plus l'état du sien.
// Les avis sont présentés comme ceux de propriétaires DÉCLARÉS : aucune preuve de
// possession n'est demandée.
export async function OwnerReviewsSection({
  modelId,
  locale,
  viewer,
  currentYear,
}: {
  modelId: number;
  locale: string;
  viewer: { id: string; emailVerified: boolean } | null;
  currentYear: number;
}) {
  const t = await getTranslations("OwnerReview");
  const numberLocale = locale === "ar" ? "ar-DZ" : "fr-DZ";
  const dateFormatter = new Intl.DateTimeFormat(numberLocale, { dateStyle: "long" });

  const [aggregate, reviews, own] = await Promise.all([
    prisma.ownerReview.aggregate({
      where: { modelId, status: "PUBLIE" },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.ownerReview.findMany({
      where: { modelId, status: "PUBLIE" },
      orderBy: { publishedAt: "desc" },
      take: REVIEWS_PER_MODEL_PAGE,
      include: { user: { include: { profile: true } } },
    }),
    viewer ? prisma.ownerReview.findUnique({ where: { userId_modelId: { userId: viewer.id, modelId } } }) : null,
  ]);

  const summary = summarizeOwnerAggregate(aggregate._avg.rating, aggregate._count._all);

  return (
    <section className="mt-10" aria-labelledby="owner-reviews-title">
      <h2 id="owner-reviews-title" className="text-lg font-semibold text-slate-900">
        {t("sectionTitle")}
      </h2>

      {summary.count > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {summary.showAverage && (
            <>
              <StarRating
                rating={summary.average}
                size={22}
                label={t("ratingAria", { rating: formatRating(summary.average, locale) })}
              />
              <span className="text-lg font-semibold text-slate-900">
                {t("averageLabel", { rating: formatRating(summary.average, locale) })}
              </span>
            </>
          )}
          <span className="text-sm text-slate-500">{t("countLabel", { count: summary.count })}</span>
        </div>
      )}
      {summary.count > 0 && !summary.showAverage && (
        <p className="mt-1 text-xs text-slate-500">{t("notEnoughForAverage", { min: MIN_REVIEWS_FOR_AVERAGE })}</p>
      )}
      <p className="mt-1 text-xs text-slate-500">{t("declaredNotice")}</p>

      {reviews.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{t("noReviews")}</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StarRating
                  rating={review.rating}
                  size={16}
                  label={t("ratingAria", { rating: formatRating(review.rating, locale) })}
                />
                <span className="text-sm font-medium text-slate-900">
                  {review.user.profile?.displayName ?? t("anonymousOwner")}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t("declaredOwner")}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {[
                  review.purchaseYear ? t("boughtIn", { year: review.purchaseYear }) : null,
                  review.mileageKm !== null ? `${review.mileageKm.toLocaleString(numberLocale)} km` : null,
                  review.publishedAt ? dateFormatter.format(review.publishedAt) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700" dir="auto">
                {review.comment}
              </p>
              {viewer?.id !== review.userId && <ReportOwnerReviewButton reviewId={review.id} />}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <h3 className="text-base font-medium text-slate-900">{t("writeTitle")}</h3>
        {!viewer ? (
          <p className="mt-2 text-sm text-slate-600">
            <Link href="/connexion" className="underline hover:text-slate-900">
              {t("loginPrompt")}
            </Link>
          </p>
        ) : !viewer.emailVerified ? (
          <p className="mt-2 text-sm text-slate-600">
            {t("verifyPrompt")}{" "}
            <Link href="/compte/profil" className="underline hover:text-slate-900">
              {t("verifyLink")}
            </Link>
          </p>
        ) : (
          <>
            {own?.status === "EN_ATTENTE" && <p className="mt-2 text-sm text-amber-700">{t("statusPending")}</p>}
            {own?.status === "PUBLIE" && <p className="mt-2 text-sm text-emerald-700">{t("statusPublished")}</p>}
            {own?.status === "REFUSE" && (
              <p className="mt-2 text-sm text-red-700">{t("statusRejected", { reason: own.rejectionReason ?? "" })}</p>
            )}
            <OwnerReviewForm
              modelId={modelId}
              currentYear={currentYear}
              existing={
                own
                  ? { rating: own.rating, comment: own.comment, purchaseYear: own.purchaseYear, mileageKm: own.mileageKm }
                  : null
              }
            />
          </>
        )}
      </div>
    </section>
  );
}
