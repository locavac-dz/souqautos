import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  return (
    <footer className="border-t border-slate-200 mt-12">
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-500 flex flex-col sm:flex-row sm:justify-between gap-2">
        <span>{t("group")}</span>
        <Link href="/voitures" className="hover:text-slate-700 hover:underline">
          {t("browseBrands")}
        </Link>
        <Link href="/mentions-legales" className="hover:text-slate-700 hover:underline">
          {t("legalNotice")}
        </Link>
        <Link href="/politique-confidentialite" className="hover:text-slate-700 hover:underline">
          {t("privacyPolicy")}
        </Link>
        <span>{t("brands")}</span>
      </div>
    </footer>
  );
}
