import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { canViewProDashboard } from "@/lib/pro-account";
import { resolveProAccess } from "@/lib/pro-access";
import { getSubscriptionStatus, hasDetailedStatistics } from "@/lib/pro-subscription";
import { loadProStats } from "@/lib/pro-stats-data";
import { STATS_RANGES, contactRatePercent, parseStatsRange, totalContacts } from "@/lib/pro-stats";
import { DailyBars } from "@/components/DailyBars";

// Lot 122 — statistiques du compte professionnel : totaux et courbes de la période pour tous les
// comptes pro ; détail par annonce pour les abonnements qui l'incluent.
export default async function ProStatsPage({ searchParams }: { searchParams: Promise<{ jours?: string | string[] }> }) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("ProStats");
  const tPro = await getTranslations("Pro");
  const resolved = await resolveProAccess(user);
  if (!resolved) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="mb-4 text-slate-600">{tPro("noAccountYet")}</p>
        <Link href="/devenir-professionnel" className="text-sm text-slate-900 underline">
          {tPro("becomeProLink")}
        </Link>
      </div>
    );
  }
  if (!canViewProDashboard(resolved.access)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-600">{tPro("forbidden")}</p>
      </div>
    );
  }

  const days = parseStatsRange((await searchParams).jours);
  const { account } = resolved;
  const [report, subscription] = await Promise.all([loadProStats(account.userId, days), getSubscriptionStatus(account.userId)]);
  const detailed = Boolean(subscription && hasDetailedStatistics(subscription.tier));

  const numberLocale = locale === "ar" ? "ar-DZ" : "fr-DZ";
  const fmt = (n: number) => n.toLocaleString(numberLocale);
  const contacts = totalContacts(report.totals);
  const rate = contactRatePercent(report.totals.views, contacts);
  const fmtRate = (value: number | null) => (value === null ? "—" : `${value.toLocaleString(numberLocale, { maximumFractionDigits: 1 })} %`);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/pro/tableau-de-bord" className="text-sm text-slate-500 hover:text-slate-900">
        {t("back")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{account.nomCommercial}</p>

      <nav aria-label={t("periodLabel")} className="mt-5 flex gap-2">
        {STATS_RANGES.map((range) => (
          <Link
            key={range}
            href={`/pro/statistiques?jours=${range}`}
            aria-current={range === days ? "true" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${range === days ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:border-slate-500"}`}
          >
            {t("range", { days: range })}
          </Link>
        ))}
      </nav>

      {report.listings.length === 0 ? (
        <p className="mt-10 rounded-lg border border-slate-200 p-6 text-center text-sm text-slate-600">{t("empty")}</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Stat label={t("statViews")} value={fmt(report.totals.views)} />
            <Stat
              label={t("statContacts")}
              value={fmt(contacts)}
              hint={t("statContactsHint", { phone: fmt(report.totals.phoneReveals), whatsapp: fmt(report.totals.whatsappOpens), conversations: fmt(report.totals.conversations) })}
            />
            <Stat label={t("statFavorites")} value={fmt(report.totals.favorites)} />
            <Stat label={t("statConversations")} value={fmt(report.totals.conversations)} />
            <Stat label={t("statRate")} value={fmtRate(rate)} hint={rate === null ? t("rateTooFewViews") : undefined} />
          </div>

          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <section>
              <h2 className="mb-2 text-sm font-medium text-slate-900">{t("chartViews")}</h2>
              <DailyBars points={report.viewsSeries} locale={locale} barClass="bg-slate-700" label={t("chartLabel", { title: t("chartViews"), total: fmt(report.totals.views) })} />
            </section>
            <section>
              <h2 className="mb-2 text-sm font-medium text-slate-900">{t("chartContacts")}</h2>
              <DailyBars points={report.contactsSeries} locale={locale} barClass="bg-emerald-600" label={t("chartLabel", { title: t("chartContacts"), total: fmt(contacts) })} />
            </section>
          </div>

          <section className="mt-10">
            <h2 className="mb-3 text-sm font-medium text-slate-900">{t("perListingTitle")}</h2>
            {detailed ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[42rem] text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-start font-medium">{t("colListing")}</th>
                      <th scope="col" className="px-3 py-2 text-end font-medium">{t("colViews")}</th>
                      <th scope="col" className="px-3 py-2 text-end font-medium">{t("colFavorites")}</th>
                      <th scope="col" className="px-3 py-2 text-end font-medium">{t("colPhone")}</th>
                      <th scope="col" className="px-3 py-2 text-end font-medium">{t("colWhatsapp")}</th>
                      <th scope="col" className="px-3 py-2 text-end font-medium">{t("colConversations")}</th>
                      <th scope="col" className="px-3 py-2 text-end font-medium">{t("colRate")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.listings.map((row) => (
                      <tr key={row.listingId}>
                        <th scope="row" className="px-3 py-2 text-start font-normal">
                          <Link href={`/annonce/${row.listingId}`} className="text-slate-900 hover:underline">
                            {row.title}
                          </Link>
                          {row.status !== "PUBLIEE" && <span className="ms-2 text-xs text-slate-400">{t(`status${row.status}` as "statusVENDUE")}</span>}
                        </th>
                        <td className="px-3 py-2 text-end tabular-nums">{fmt(row.views)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{fmt(row.favorites)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{fmt(row.phoneReveals)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{fmt(row.whatsappOpens)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{fmt(row.conversations)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{fmtRate(contactRatePercent(row.views, totalContacts(row)))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-600">
                <p>{t("detailLocked")}</p>
                <Link href="/professionnels" className="mt-2 inline-block text-slate-900 underline">
                  {t("detailLockedLink")}
                </Link>
              </div>
            )}
          </section>

          <div className="mt-10 space-y-1 text-xs text-slate-500">
            <p>{t("noteContact")}</p>
            <p>{t("noteViews")}</p>
            <p>{t("noteHistory")}</p>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
