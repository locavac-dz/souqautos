import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { InstallAppButton } from "@/components/InstallAppButton";
import { SiteWordMark } from "@/components/SiteWordMark";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  return (
    <footer className="border-t border-slate-200 bg-slate-50 mt-12">
      <div className="mx-auto max-w-6xl px-4 py-10 grid sm:grid-cols-2 gap-8">
        <div>
          <SiteWordMark className="text-2xl" />
          <p className="mt-2 text-xs text-slate-500">{t("group")}</p>
<div className="mt-4">
            <InstallAppButton />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs text-slate-500">
          <div className="flex flex-col gap-2">
            <Link href="/voitures" className="hover:text-slate-700">{t("browseBrands")}</Link>
            <Link href="/wilaya" className="hover:text-slate-700">{t("browseWilayas")}</Link>
            <Link href="/mag" className="hover:text-slate-700">{t("blog")}</Link>
            <Link href="/essais" className="hover:text-slate-700">{t("roadTests")}</Link>
            <Link href="/guides" className="hover:text-slate-700">{t("guides")}</Link>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/professionnels" className="hover:text-slate-700">{t("professionals")}</Link>
            <Link href="/concessionnaires" className="hover:text-slate-700">{t("professionalsDirectory")}</Link>
            <Link href="/mentions-legales" className="hover:text-slate-700">{t("legalNotice")}</Link>
            <Link href="/politique-confidentialite" className="hover:text-slate-700">{t("privacyPolicy")}</Link>
            <Link href="/conditions-generales" className="hover:text-slate-700">{t("terms")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
