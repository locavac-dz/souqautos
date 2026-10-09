import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { getModelYearStats } from "@/lib/catalogue-stats";

interface Props {
  brandId: number;
  modelId: number;
  year: number;
  listingPrice: number;
  brandName: string;
  modelName: string;
  brandSlug: string;
  modelSlug: string;
}

// Lot 172 — encart « marché » sur la fiche annonce : fourchette P25–P75 des annonces
// en ligne pour le même modèle et la même année. Montre à l'acheteur si le prix affiché
// est dans la norme, au-dessus ou en dessous — sans avoir à comparer manuellement.
export async function MarketStatsWidget({
  brandId,
  modelId,
  year,
  listingPrice,
  brandName,
  modelName,
  brandSlug,
  modelSlug,
}: Props) {
  const [stats, t] = await Promise.all([
    getModelYearStats({ brandId, modelId, year }),
    getTranslations("MarketStats"),
  ]);

  if (stats.p25 === null || stats.p75 === null) return null;

  const locale = await getLocale();
  const fmt = (n: number) => formatNumber(n, locale);

  let badge: "below" | "within" | "above";
  if (listingPrice < stats.p25) badge = "below";
  else if (listingPrice > stats.p75) badge = "above";
  else badge = "within";

  const badgeStyle = {
    within: "text-emerald-700 bg-emerald-50 border-emerald-200",
    below: "text-sky-700 bg-sky-50 border-sky-200",
    above: "text-amber-700 bg-amber-50 border-amber-200",
  }[badge];

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
        {t("title", { brand: brandName, model: modelName, year })}
      </p>
      <div className="rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {fmt(stats.p25)} – {fmt(stats.p75)} <span className="font-normal text-slate-500 dark:text-slate-400">DA</span>
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t("countLabel", { count: stats.count })}</p>
      </div>
      <div className={`mt-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${badgeStyle}`}>
        {badge === "within" && <span aria-hidden="true">✓</span>}
        {badge === "above" && <span aria-hidden="true">↑</span>}
        {badge === "below" && <span aria-hidden="true">↓</span>}
        {t(`badge_${badge}`)}
      </div>
      <div className="mt-2">
        <Link
          href={`/voitures/${brandSlug}/${modelSlug}`}
          className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:underline"
        >
          {t("viewModel", { model: modelName })}
          <span aria-hidden="true" className="rtl:hidden"> →</span>
          <span aria-hidden="true" className="ltr:hidden"> ←</span>
        </Link>
      </div>
    </div>
  );
}
