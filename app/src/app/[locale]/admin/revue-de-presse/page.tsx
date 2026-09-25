import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { articleStatus } from "@/lib/blog-publication";
import { hostLabel } from "@/lib/press-review";
import { DeletePressReviewButton } from "@/components/admin/DeletePressReviewButton";

// Lot 114 — revue de presse : liens vers des essais publiés ailleurs (ADMIN seulement).
export default async function AdminPressReviewsPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }

  const t = await getTranslations("AdminPressReview");
  const reviews = await prisma.pressReview.findMany({
    orderBy: { createdAt: "desc" },
    include: { brand: true, model: true },
  });
  const now = new Date();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{t("title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("subtitle")}</p>
        </div>
        <Link
          href="/admin/revue-de-presse/nouveau"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          {t("newReview")}
        </Link>
      </div>

      {reviews.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t("empty")}</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const status = articleStatus(review.publishedAt, now);
            const vehicle = [review.brand?.name, review.model?.name].filter(Boolean).join(" ");
            return (
              <div
                key={review.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate" dir="auto">
                    {review.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {review.sourceName} · {hostLabel(review.url)}
                    {vehicle && ` · ${vehicle}`} ·{" "}
                    {status === "published" ? (
                      <span className="text-emerald-700">{t("statusPublished")}</span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">{t("statusDraft")}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <a
                    href={review.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-xs text-slate-600 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    {t("openSource")}
                  </a>
                  <Link
                    href={`/admin/revue-de-presse/${review.id}/modifier`}
                    className="text-xs text-slate-600 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    {t("edit")}
                  </Link>
                  <DeletePressReviewButton reviewId={review.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
