import { getLocale, getTranslations } from "next-intl/server";
import { formatNumber } from "@/lib/format";
import { loadTeamActivity } from "@/lib/moderation-assignment";

// Lot 277 — activité de l'équipe sur 7 jours (décisions réelles du journal d'audit + éléments en cours).
export async function TeamActivityTable() {
  const locale = await getLocale();
  const t = await getTranslations("Admin");
  const rows = await loadTeamActivity();

  const th = "py-1.5 pr-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400";
  const td = "py-1.5 pr-4 text-slate-700 dark:text-slate-300";

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">{t("teamActivityTitle")}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{t("teamActivityEmpty")}</p>
      ) : (
        <table className="text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className={th}>{t("teamColMember")}</th>
              <th className={th}>{t("teamColListings")}</th>
              <th className={th}>{t("teamColReports")}</th>
              <th className={th}>{t("teamColDelay")}</th>
              <th className={th}>{t("teamColInProgress")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.adminId} className="border-b border-slate-100 dark:border-slate-800">
                <td className={`${td} font-medium text-slate-900 dark:text-slate-100`}>{r.email}</td>
                <td className={td}>{formatNumber(r.listings, locale)}</td>
                <td className={td}>{formatNumber(r.reports, locale)}</td>
                <td className={td}>{r.avgListingDelayHours === null ? "—" : t("teamDelayHours", { hours: formatNumber(r.avgListingDelayHours, locale) })}</td>
                <td className={td}>{formatNumber(r.inProgress, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
