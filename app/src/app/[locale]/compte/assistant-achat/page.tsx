import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { AiAdvisorChat } from "@/components/advisor/AiAdvisorChat";

export default async function AiAdvisorPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("AiAdvisor");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{t("pageTitle")}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t("pageIntro")}</p>
      <AiAdvisorChat />
    </div>
  );
}
