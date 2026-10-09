import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isEditor } from "@/lib/auth-server/roles";
import { BlogArticleForm } from "@/components/admin/BlogArticleForm";
import { PreviewLinksSection } from "@/components/admin/PreviewLinksSection";
import { getCatalogueForRoadTests } from "@/lib/road-test-catalogue";
import { articleStatus } from "@/lib/blog-publication";

export default async function EditRoadTestPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isEditor(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }

  const t = await getTranslations("AdminRoadTest");
  const article = await prisma.blogArticle.findUnique({ where: { id }, include: { roadTest: true } });
  if (!article || article.kind !== "ESSAI") notFound();

  const brands = await getCatalogueForRoadTests();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">{t("editEssai")}</h1>
      <BlogArticleForm
        kind="ESSAI"
        article={article}
        status={articleStatus(article.publishedAt, new Date())}
        brands={brands}
      />
      <PreviewLinksSection articleId={article.id} publishedAt={article.publishedAt} />
    </div>
  );
}
