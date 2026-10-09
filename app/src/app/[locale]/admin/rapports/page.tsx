import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { formatNumber } from "@/lib/format";
import { SendWeeklyReportButton } from "@/components/admin/SendWeeklyReportButton";
import type { WeeklyMetrics } from "@/lib/weekly-report";

// Lot 275 — rapports hebdomadaires déjà envoyés (chiffres conservés) et envoi manuel.
export const dynamic = "force-dynamic";
const SHOWN = 26;

export default async function AdminWeeklyReportsPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }
  const t = await getTranslations("Admin");

  const reports = await prisma.weeklyReport.findMany({ orderBy: { periodStart: "desc" }, take: SHOWN });
  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "medium" });
  const dateTimeFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "medium", timeStyle: "short" });

  const th = "py-2 pr-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400";
  const td = "py-2 pr-4 align-top text-slate-700 dark:text-slate-300 whitespace-nowrap";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{t("weeklyReportTitle")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t("weeklyReportIntro")}</p>
        <SendWeeklyReportButton />
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("weeklyReportEmpty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className={th}>{t("weeklyReportColPeriod")}</th>
                <th className={th}>{t("weeklyReportColPublished")}</th>
                <th className={th}>{t("weeklyReportColPending")}</th>
                <th className={th}>{t("weeklyReportColPayments")}</th>
                <th className={th}>{t("weeklyReportColContacts")}</th>
                <th className={th}>{t("weeklyReportColSentAt")}</th>
                <th className={th}>{t("weeklyReportColRecipients")}</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const current = (r.payload as { current?: WeeklyMetrics }).current;
                return (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className={`${td} font-medium text-slate-900 dark:text-slate-100`}>
                      {dateFormatter.format(r.periodStart)} → {dateFormatter.format(new Date(r.periodEnd.getTime() - 86_400_000))}
                    </td>
                    <td className={td}>
                      {current ? `${formatNumber(current.listingsPublished, locale)} (${formatNumber(current.listingsAutoPublished, locale)} auto)` : "—"}
                    </td>
                    <td className={td}>{current ? formatNumber(current.pendingNow, locale) : "—"}</td>
                    <td className={td}>
                      {current ? `${formatNumber(current.paymentsConfirmedCount, locale)} · ${formatNumber(current.paymentsConfirmedAmountDzd, locale)}` : "—"}
                    </td>
                    <td className={td}>
                      {current ? `${formatNumber(current.contactsReceived, locale)} / ${formatNumber(current.contactsAnswered, locale)}` : "—"}
                    </td>
                    <td className={td}>{dateTimeFormatter.format(r.sentAt)}</td>
                    <td className={`${td} whitespace-normal`}>{r.recipients}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
