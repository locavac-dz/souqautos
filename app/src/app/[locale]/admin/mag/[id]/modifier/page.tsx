import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { BlogArticleForm } from "@/components/admin/BlogArticleForm";
import { articleStatus } from "@/lib/blog-publication";

export default async function EditBlogArticlePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }

  const t = await getTranslations("AdminBlog");
  const article = await prisma.blogArticle.findUnique({ where: { id } });
  if (!article) notFound();
  // Lot 110 — un essai s'édite dans sa propre rubrique (fiche d'essai).
  if (article.kind === "ESSAI") {
    redirect({ href: `/admin/essais/${article.id}/modifier`, locale });
    return null;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">{t("editArticle")}</h1>
      <BlogArticleForm article={article} status={articleStatus(article.publishedAt, new Date())} />
    </div>
  );
}
