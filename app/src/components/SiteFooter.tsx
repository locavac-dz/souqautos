import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { InstallAppButton } from "@/components/InstallAppButton";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  return (
    <footer className="border-t border-slate-200 mt-12">
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-500 flex flex-col sm:flex-row sm:justify-between gap-2">
        <span>{t("group")}</span>
        <InstallAppButton />
        <Link href="/voitures" className="hover:text-slate-700 hover:underline">
          {t("browseBrands")}
        </Link>
        <Link href="/wilaya" className="hover:text-slate-700 hover:underline">
          {t("browseWilayas")}
        </Link>
        <Link href="/mag" className="hover:text-slate-700 hover:underline">
          {t("blog")}
        </Link>
        <Link href="/essais" className="hover:text-slate-700 hover:underline">
          {t("roadTests")}
        </Link>
        <Link href="/guides" className="hover:text-slate-700 hover:underline">
          {t("guides")}
        </Link>
        <Link href="/professionnels" className="hover:text-slate-700 hover:underline">
          {t("professionals")}
        </Link>
        <Link href="/concessionnaires" className="hover:text-slate-700 hover:underline">
          {t("professionalsDirectory")}
        </Link>
        <Link href="/mentions-legales" className="hover:text-slate-700 hover:underline">
          {t("legalNotice")}
        </Link>
        <Link href="/politique-confidentialite" className="hover:text-slate-700 hover:underline">
          {t("privacyPolicy")}
        </Link>
        <Link href="/conditions-generales" className="hover:text-slate-700 hover:underline">
          {t("terms")}
        </Link>
        <span>{t("brands")}</span>
      </div>
    </footer>
  );
}
