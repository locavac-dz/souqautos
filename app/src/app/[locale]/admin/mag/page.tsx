import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { DeleteBlogArticleButton } from "@/components/admin/DeleteBlogArticleButton";

// Réservé à ADMIN — le blog est un contenu public engageant l'image de la
// marque, pas une action de modération courante (cf. route.ts).
export default async function AdminBlogPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }

  const t = await getTranslations("AdminBlog");
  const articles = await prisma.blogArticle.findMany({ orderBy: { createdAt: "desc" } });

  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
    dateStyle: "medium",
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">{t("title")}</h1>
          <p className="text-sm text-slate-500">{t("subtitle")}</p>
        </div>
        <Link
          href="/admin/mag/nouveau"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {t("newArticle")}
        </Link>
      </div>

      {articles.length === 0 ? (
        <p className="text-slate-500 text-sm">{t("empty")}</p>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <div key={article.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3">
              <div>
                <p className="font-medium text-slate-900">{article.titleFr}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {article.publishedAt ? (
                    <span className="text-emerald-700">
                      {t("publishedOn", { date: dateFormatter.format(article.publishedAt) })}
                    </span>
                  ) : (
                    <span className="text-slate-400">{t("draft")}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {article.publishedAt && (
                  <Link
                    href={`/mag/${article.slug}`}
                    target="_blank"
                    className="text-xs text-slate-600 underline hover:text-slate-900"
                  >
                    {t("view")}
                  </Link>
                )}
                <Link
                  href={`/admin/mag/${article.id}/modifier`}
                  className="text-xs text-slate-600 underline hover:text-slate-900"
                >
                  {t("edit")}
                </Link>
                <DeleteBlogArticleButton articleId={article.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
