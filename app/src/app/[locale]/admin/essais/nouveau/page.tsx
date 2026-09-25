import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { BlogArticleForm } from "@/components/admin/BlogArticleForm";
import { getCatalogueForRoadTests } from "@/lib/road-test-catalogue";

export default async function NewRoadTestPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }

  const t = await getTranslations("AdminRoadTest");
  const brands = await getCatalogueForRoadTests();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">{t("newEssai")}</h1>
      <BlogArticleForm kind="ESSAI" brands={brands} />
    </div>
  );
}
