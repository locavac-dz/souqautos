import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { articleStatus } from "@/lib/blog-publication";
import { DeleteBlogArticleButton } from "@/components/admin/DeleteBlogArticleButton";
import type { ArticleKind } from "@prisma/client";

// Lot 110 — liste d'administration partagée par le magazine (`/admin/mag`) et
// les essais (`/admin/essais`) : mêmes actions, même affichage de l'état
// (brouillon / programmé / publié), seuls le type d'article et les liens changent.
export async function AdminBlogList({ kind }: { kind: ArticleKind }) {
  const locale = await getLocale();
  const isEssai = kind === "ESSAI";
  const t = await getTranslations("AdminBlog");
  const tRt = await getTranslations("AdminRoadTest");
  const now = new Date();

  const articles = await prisma.blogArticle.findMany({
    where: { kind },
    orderBy: { createdAt: "desc" },
  });

  const bcp47 = locale === "ar" ? "ar-DZ" : "fr-DZ";
  const dateFormatter = new Intl.DateTimeFormat(bcp47, { dateStyle: "medium" });
  const dateTimeFormatter = new Intl.DateTimeFormat(bcp47, { dateStyle: "medium", timeStyle: "short" });

  const base = isEssai ? "/admin/essais" : "/admin/mag";
  const publicBase = isEssai ? "/essais" : "/mag";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">
            {isEssai ? tRt("title") : t("title")}
          </h1>
          <p className="text-sm text-slate-500">{isEssai ? tRt("subtitle") : t("subtitle")}</p>
        </div>
        <Link
          href={`${base}/nouveau`}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {isEssai ? tRt("newEssai") : t("newArticle")}
        </Link>
      </div>

      {articles.length === 0 ? (
        <p className="text-slate-500 text-sm">{isEssai ? tRt("empty") : t("empty")}</p>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => {
            const status = articleStatus(article.publishedAt, now);
            return (
              <div
                key={article.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{article.titleFr}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {status === "published" && article.publishedAt && (
                      <span className="text-emerald-700">
                        {t("publishedOn", { date: dateFormatter.format(article.publishedAt) })}
                      </span>
                    )}
                    {status === "scheduled" && article.publishedAt && (
                      <span className="text-amber-700">
                        {t("scheduledFor", { date: dateTimeFormatter.format(article.publishedAt) })}
                      </span>
                    )}
                    {status === "draft" && <span className="text-slate-400">{t("draft")}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {status === "published" && (
                    <Link
                      href={`${publicBase}/${article.slug}`}
                      target="_blank"
                      className="text-xs text-slate-600 underline hover:text-slate-900"
                    >
                      {t("view")}
                    </Link>
                  )}
                  <Link
                    href={`${base}/${article.id}/modifier`}
                    className="text-xs text-slate-600 underline hover:text-slate-900"
                  >
                    {t("edit")}
                  </Link>
                  <DeleteBlogArticleButton articleId={article.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
