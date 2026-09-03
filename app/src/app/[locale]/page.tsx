import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SearchFilters } from "@/components/search/SearchFilters";

export default async function HomePage() {
  const t = await getTranslations("Home");

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 text-balance">
        {t("heroTitle")}
      </h1>
      <p className="mt-3 text-slate-600">{t("heroSubtitle")}</p>

      <div className="mt-8">
        <SearchFilters brands={[]} wilayas={[]} initialValues={{}} compact />
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link
          href="/vendre"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-slate-400"
        >
          {t("sellButton")}
        </Link>
        <Link
          href="/cote-souq-auto"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-slate-400"
        >
          {t("estimateButton")}
        </Link>
        <Link
          href="/voitures"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-slate-400"
        >
          {t("browseBrandsButton")}
        </Link>
      </div>
    </div>
  );
}
