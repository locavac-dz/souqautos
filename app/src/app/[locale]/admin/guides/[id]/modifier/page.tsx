import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { BlogArticleForm } from "@/components/admin/BlogArticleForm";
import { PreviewLinksSection } from "@/components/admin/PreviewLinksSection";
import { getCatalogueForRoadTests } from "@/lib/road-test-catalogue";
import { articleStatus } from "@/lib/blog-publication";

export default async function EditGuidePage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }

  const t = await getTranslations("AdminGuide");
  const article = await prisma.blogArticle.findUnique({ where: { id }, include: { guide: true } });
  if (!article || article.kind !== "GUIDE") notFound();

  const brands = await getCatalogueForRoadTests();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">{t("editGuide")}</h1>
      <BlogArticleForm kind="GUIDE" article={article} status={articleStatus(article.publishedAt, new Date())} brands={brands} />
      <PreviewLinksSection articleId={article.id} publishedAt={article.publishedAt} />
    </div>
  );
}
