import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isEditor } from "@/lib/auth-server/roles";
import { BlogArticleForm } from "@/components/admin/BlogArticleForm";

export default async function NewBlogArticlePage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isEditor(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }

  const t = await getTranslations("AdminBlog");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">{t("newArticle")}</h1>
      <BlogArticleForm />
    </div>
  );
}
