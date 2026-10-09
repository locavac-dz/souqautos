import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isEditor } from "@/lib/auth-server/roles";
import { PressReviewForm } from "@/components/admin/PressReviewForm";
import { getCatalogueForRoadTests } from "@/lib/road-test-catalogue";

export default async function NewPressReviewPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isEditor(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }

  const t = await getTranslations("AdminPressReview");
  const brands = await getCatalogueForRoadTests();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">{t("newReview")}</h1>
      <PressReviewForm brands={brands} />
    </div>
  );
}
