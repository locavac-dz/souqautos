import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isModerator } from "@/lib/auth-server/roles";
import { STATS_RANGES, parseStatsRange } from "@/lib/pro-stats";
import { contentHref, loadAudience, percentChange, sharePercent, type CountRow } from "@/lib/audience-data";
import { DailyBars } from "@/components/DailyBars";

// Lot 124 — audience du site : pages vues, sans aucun identifiant de visiteur (voir src/lib/analytics.ts).
// L'accès est celui de tout le back-office (équipe seulement, contrôlé par le layout d'administration).
export default async function AdminAudiencePage({ searchParams }: { searchParams: Promise<{ jours?: string | string[] }> }) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isModerator(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }
  const t = await getTranslations("Audience");
  const days = parseStatsRange((await searchParams).jours);
  const report = await loadAudience(days);

  const numberLocale = locale === "ar" ? "ar-DZ" : "fr-DZ";
  const fmt = (n: number) => n.toLocaleString(numberLocale);
  const change = percentChange(report.total, report.previousTotal);
  const perDayAverage = Math.round(report.total / days);
  const referrerLabel = (key: string) => t(`referrer_${key}` as "referrer_direct");
  const deviceLabel = (key: string) => t(`device_${key}` as "device_mobile");
  const localeLabel = (key: string) => (key === "ar" ? t("localeAr") : t("localeFr"));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("subtitle")}</p>

      <nav aria-label={t("periodLabel")} className="mt-5 flex gap-2">
        {STATS_RANGES.map((range) => (
          <Link
            key={range}
            href={`/admin/audience?jours=${range}`}
            aria-current={range === days ? "true" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${range === days ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900" : "border-slate-300 text-slate-700 hover:border-slate-500 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-400"}`}
          >
            {t("range", { days: range })}
          </Link>
        ))}
      </nav>

      {report.total === 0 ? (
        <p className="mt-8 rounded-lg border border-slate-200 dark:border-slate-700 p-6 text-center text-sm text-slate-600 dark:text-slate-300">{t("empty")}</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label={t("statViews")} value={fmt(report.total)} hint={change === null ? undefined : t("changeVsPrevious", { change: `${change > 0 ? "+" : ""}${change}` })} />
            <Stat label={t("statPerDay")} value={fmt(perDayAverage)} />
            <Stat label={t("statMobile")} value={`${sharePercent(report.devices.find((d) => d.label === "mobile")?.count ?? 0, report.total)} %`} />
            <Stat label={t("statSearch")} value={`${sharePercent(report.referrers.find((r) => r.label === "recherche")?.count ?? 0, report.total)} %`} />
          </div>

          <section className="mt-8">
            <h2 className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">{t("chartTitle")}</h2>
            <DailyBars points={report.perDay} locale={locale} barClass="bg-slate-700" label={t("chartLabel", { total: fmt(report.total) })} />
          </section>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            <Table title={t("topPages")} rows={report.pages.slice(0, 12)} total={report.total} fmt={fmt} mono />
            <section>
              <h2 className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">{t("topContent")}</h2>
              {report.content.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("topContentEmpty")}</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {report.content.slice(0, 12).map((row) => {
                        const href = contentHref(row.page, row.detail);
                        return (
                          <tr key={`${row.page}|${row.detail}`}>
                            <th scope="row" className="px-3 py-2 text-start font-normal">
                              {href ? (
                                <Link href={href} className="text-slate-900 dark:text-slate-100 hover:underline">
                                  {row.detail}
                                </Link>
                              ) : (
                                row.detail
                              )}
                              <span className="ms-2 text-xs text-slate-500 dark:text-slate-400">{row.page.split("/")[1]}</span>
                            </th>
                            <td className="px-3 py-2 text-end tabular-nums">{fmt(row.count)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            <Table title={t("referrers")} rows={report.referrers.map((r) => ({ ...r, label: referrerLabel(r.label) }))} total={report.total} fmt={fmt} />
            <Table title={t("devices")} rows={report.devices.map((r) => ({ ...r, label: deviceLabel(r.label) }))} total={report.total} fmt={fmt} />
            <Table title={t("locales")} rows={report.locales.map((r) => ({ ...r, label: localeLabel(r.label) }))} total={report.total} fmt={fmt} />
          </div>
        </>
      )}

      <div className="mt-10 space-y-1 text-xs text-slate-500 dark:text-slate-400">
        <p>{t("noteWhat")}</p>
        <p>{t("noteNotVisitors")}</p>
        <p>{t("noteUndercount")}</p>
        <p>{t("noteRetention")}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

function Table({ title, rows, total, fmt, mono }: { title: string; rows: CountRow[]; total: number; fmt: (n: number) => string; mono?: boolean }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">{title}</h2>
      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className={`px-3 py-2 text-start font-normal ${mono ? "font-mono text-xs" : ""}`} dir={mono ? "ltr" : undefined}>
                  {row.label}
                </th>
                <td className="px-3 py-2 text-end tabular-nums">{fmt(row.count)}</td>
                <td className="w-16 whitespace-nowrap px-3 py-2 text-end text-xs text-slate-500 dark:text-slate-400 tabular-nums">{sharePercent(row.count, total)} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
