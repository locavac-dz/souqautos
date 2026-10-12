import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { InstallAppButton } from "@/components/InstallAppButton";
import { SiteWordMark } from "@/components/SiteWordMark";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  return (
    <footer className="border-t border-slate-200 bg-slate-50 mt-12 dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-10 grid sm:grid-cols-2 gap-8">
        <div>
          <SiteWordMark className="text-2xl" />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t("group")}</p>
<div className="mt-4">
            <InstallAppButton />
          </div>
        </div>

        <nav aria-label={t("navLabel")} className="grid grid-cols-2 gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex flex-col gap-2">
            <Link href="/voitures" className="hover:text-slate-700 dark:hover:text-slate-200">{t("browseBrands")}</Link>
            <Link href="/wilaya" className="hover:text-slate-700 dark:hover:text-slate-200">{t("browseWilayas")}</Link>
            <Link href="/mag" className="hover:text-slate-700 dark:hover:text-slate-200">{t("blog")}</Link>
            <Link href="/essais" className="hover:text-slate-700 dark:hover:text-slate-200">{t("roadTests")}</Link>
            <Link href="/guides" className="hover:text-slate-700 dark:hover:text-slate-200">{t("guides")}</Link>
            <Link href="/equipement" className="hover:text-slate-700 dark:hover:text-slate-200">{t("equipment")}</Link>
            <Link href="/assurance" className="hover:text-slate-700 dark:hover:text-slate-200">{t("insurance")}</Link>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/professionnels" className="hover:text-slate-700 dark:hover:text-slate-200">{t("professionals")}</Link>
            <Link href="/concessionnaires" className="hover:text-slate-700 dark:hover:text-slate-200">{t("professionalsDirectory")}</Link>
            <Link href="/contact" className="hover:text-slate-700 dark:hover:text-slate-200">{t("contact")}</Link>
            <Link href="/mentions-legales" className="hover:text-slate-700 dark:hover:text-slate-200">{t("legalNotice")}</Link>
            <Link href="/politique-confidentialite" className="hover:text-slate-700 dark:hover:text-slate-200">{t("privacyPolicy")}</Link>
            <Link href="/conditions-generales" className="hover:text-slate-700 dark:hover:text-slate-200">{t("terms")}</Link>
          </div>
        </nav>
      </div>
    </footer>
  );
}
