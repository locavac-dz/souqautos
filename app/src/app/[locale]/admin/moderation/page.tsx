import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isModerator } from "@/lib/auth-server/roles";
import { loadModerationStats, FRAUD_SCORE_RANGES, type FraudScoreBucket } from "@/lib/moderation-stats";
import { DailyBars } from "@/components/DailyBars";

export default async function AdminModerationPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isModerator(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }

  const t = await getTranslations("AdminModeration");
  const report = await loadModerationStats();

  const numberLocale = locale === "ar" ? "ar-DZ" : "fr-DZ";
  const fmt = (n: number) => n.toLocaleString(numberLocale);
  const dateFmt = new Intl.DateTimeFormat(numberLocale, { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" });

  const weeklyPoints = report.weekly.map((w) => ({
    day: w.weekStart.toISOString().slice(0, 10),
    value: w.count,
  }));
  const weeklyTotal = report.weekly.reduce((s, w) => s + w.count, 0);

  const maxBucket = Math.max(...report.fraudDistribution.map((b) => b.count), 1);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("subtitle")}</p>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t("kpiTotal")} value={fmt(report.kpis.totalModerated)} sub={t("kpiLast30")} />
        <KpiCard
          label={t("kpiAutoRate")}
          value={`${report.kpis.autoPublishRate}%`}
          sub={t("kpiAutoRateSub", { auto: fmt(report.kpis.autoPublished), human: fmt(report.kpis.humanApproved) })}
          accent={report.kpis.autoPublishRate >= 50 ? "emerald" : "slate"}
        />
        <KpiCard
          label={t("kpiAiSuspicion")}
          value={`${report.kpis.aiSuspicionRate}%`}
          sub={t("kpiAiSuspicionSub")}
          accent={report.kpis.aiSuspicionRate > 20 ? "amber" : "slate"}
        />
        <KpiCard
          label={t("kpiAvgTime")}
          value={report.kpis.avgModerationHours != null ? t("kpiAvgTimeValue", { hours: report.kpis.avgModerationHours }) : "—"}
          sub={t("kpiAvgTimeSub")}
        />
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <MiniCard label={t("approved")} value={fmt(report.kpis.humanApproved)} cls="text-emerald-700 dark:text-emerald-400" />
        <MiniCard label={t("autoPublished")} value={fmt(report.kpis.autoPublished)} cls="text-sky-700 dark:text-sky-400" />
        <MiniCard label={t("rejected")} value={fmt(report.kpis.rejected)} cls="text-red-700 dark:text-red-400" />
        <MiniCard label={t("suspended")} value={fmt(report.kpis.suspended)} cls="text-amber-700 dark:text-amber-400" />
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-1 text-sm font-medium text-slate-900 dark:text-slate-100">{t("weeklyTitle")}</h2>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{t("weeklyHelp", { total: fmt(weeklyTotal) })}</p>
          <DailyBars points={weeklyPoints} locale={locale} barClass="bg-slate-700 dark:bg-slate-400" label={t("weeklyChartLabel", { total: fmt(weeklyTotal) })} />
        </section>

        <section>
          <h2 className="mb-1 text-sm font-medium text-slate-900 dark:text-slate-100">{t("fraudTitle")}</h2>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{t("fraudHelp")}</p>
          <div className="space-y-2">
            {report.fraudDistribution.map((bucket) => (
              <FraudBar key={bucket.label} bucket={bucket} max={maxBucket} fmt={fmt} />
            ))}
          </div>
        </section>
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">{t("pendingQueue")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{fmt(report.pendingCount)}</p>
          {report.oldestPendingAt && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("oldestPending", { date: dateFmt.format(report.oldestPendingAt) })}</p>
          )}
          <Link href="/admin/annonces" className="mt-2 inline-block text-sm text-slate-900 dark:text-slate-100 underline hover:text-slate-700 dark:hover:text-slate-300">
            {t("viewQueue")}
          </Link>
        </div>
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">{t("publishedFlagged")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">{fmt(report.publishedFlagged)}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("publishedFlaggedHelp")}</p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">{t("moderationSettings")}</p>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{t("moderationSettingsHelp")}</p>
          <Link href="/admin/parametres" className="mt-2 inline-block text-sm text-slate-900 dark:text-slate-100 underline hover:text-slate-700 dark:hover:text-slate-300">
            {t("viewSettings")}
          </Link>
        </div>
      </section>

      <div className="mt-10 text-xs text-slate-500 dark:text-slate-400">
        <p>{t("note")}</p>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, accent = "slate" }: { label: string; value: string; sub: string; accent?: string }) {
  const accentCls = accent === "emerald"
    ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10"
    : accent === "amber"
      ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10"
      : "border-slate-200 dark:border-slate-700";
  return (
    <div className={`rounded-lg border p-4 ${accentCls}`}>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
    </div>
  );
}

function MiniCard({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function FraudBar({ bucket, max, fmt }: { bucket: FraudScoreBucket; max: number; fmt: (n: number) => string }) {
  const pct = max === 0 ? 0 : Math.round((bucket.count / max) * 100);
  const cls = bucket.min >= 61 ? "bg-red-500" : bucket.min >= 21 ? "bg-amber-500" : "bg-slate-400 dark:bg-slate-500";
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-end text-xs tabular-nums text-slate-500 dark:text-slate-400">{bucket.label}</span>
      <div className="flex-1 h-5 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
        {pct > 0 && <div className={`h-full rounded ${cls}`} style={{ width: `${Math.max(pct, 2)}%` }} />}
      </div>
      <span className="w-10 shrink-0 text-end text-xs tabular-nums text-slate-700 dark:text-slate-300">{fmt(bucket.count)}</span>
    </div>
  );
}
