import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { loadEditorial, type SectionSummary } from "@/lib/editorial-data";
import { coveragePercent, type EditorialSection } from "@/lib/editorial";
import { DailyBars } from "@/components/DailyBars";

// Lot 127 — suivi du rythme éditorial : où en est chaque rubrique, ce qui est programmé, les
// brouillons oubliés, les modèles qui attendent un guide. ADMIN seulement, comme les contenus.
const ADMIN_BASE: Record<EditorialSection, string> = {
  press: "/admin/revue-de-presse",
  roadTests: "/admin/essais",
  magazine: "/admin/mag",
  guides: "/admin/guides",
};

export default async function AdminEditorialPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }

  const t = await getTranslations("AdminEditorial");
  const report = await loadEditorial();

  const numberLocale = locale === "ar" ? "ar-DZ" : "fr-DZ";
  const fmt = (n: number) => n.toLocaleString(numberLocale);
  const dateFmt = new Intl.DateTimeFormat(numberLocale, { dateStyle: "medium" });
  const dateTimeFmt = new Intl.DateTimeFormat(numberLocale, { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" });
  const sectionLabel = (s: EditorialSection) => t(`section_${s}` as "section_press");

  const coverage = coveragePercent(report.modelsWithGuide, report.modelsOnSite);
  const weeklyPoints = report.weekly.map((w) => ({ day: w.weekStart.toISOString().slice(0, 10), value: w.count }));
  const weeklyTotal = report.weekly.reduce((sum, w) => sum + w.count, 0);
  const lateCount = report.sections.filter((s) => s.freshness.status === "late").length;
  const totalScheduled = report.sections.reduce((sum, s) => sum + s.scheduled, 0);
  const totalDrafts = report.sections.reduce((sum, s) => sum + s.drafts, 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
      {lateCount > 0 && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{t("lateBanner", { count: lateCount })}</p>}

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {report.sections.map((s) => (
          <SectionCard key={s.section} s={s} label={sectionLabel(s.section)} t={t} dateFmt={dateFmt} fmt={fmt} />
        ))}
      </section>

      <section className="mt-10">
        <h2 className="mb-1 text-sm font-medium text-slate-900">{t("rhythmTitle")}</h2>
        <p className="mb-2 text-xs text-slate-500">{t("rhythmHelp", { total: fmt(weeklyTotal) })}</p>
        <DailyBars points={weeklyPoints} locale={locale} barClass="bg-slate-700" label={t("rhythmChartLabel", { total: fmt(weeklyTotal) })} />
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section className="min-w-0">
          <h2 className="mb-2 text-sm font-medium text-slate-900">{t("scheduledTitle")}</h2>
          {report.scheduled.length === 0 ? (
            <p className="text-sm text-slate-500">{t("scheduledEmpty")}</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {report.scheduled.map((item) => (
                <li key={`${item.section}-${item.id}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <Link href={item.section === "press" ? ADMIN_BASE.press : `${ADMIN_BASE[item.section]}/${item.id}/modifier`} className="block truncate text-slate-900 hover:underline">
                      {item.title}
                    </Link>
                    <p className="text-xs text-slate-500">{sectionLabel(item.section)}</p>
                  </div>
                  <span className="shrink-0 text-xs text-amber-700">{dateTimeFmt.format(item.publishedAt)}</span>
                </li>
              ))}
            </ul>
          )}
          {totalScheduled > report.scheduled.length && <p className="mt-1 text-xs text-slate-500">{t("listCapped", { shown: fmt(report.scheduled.length), total: fmt(totalScheduled) })}</p>}
        </section>

        <section className="min-w-0">
          <h2 className="mb-2 text-sm font-medium text-slate-900">{t("draftsTitle")}</h2>
          {report.drafts.length === 0 ? (
            <p className="text-sm text-slate-500">{t("draftsEmpty")}</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {report.drafts.map((item) => (
                <li key={`${item.section}-${item.id}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <Link href={item.section === "press" ? ADMIN_BASE.press : `${ADMIN_BASE[item.section]}/${item.id}/modifier`} className="block truncate text-slate-900 hover:underline">
                      {item.title}
                    </Link>
                    <p className="text-xs text-slate-500">{sectionLabel(item.section)}</p>
                  </div>
                  <span className={`shrink-0 text-xs ${item.stale ? "text-red-600" : "text-slate-500"}`}>
                    {item.stale ? t("draftStale", { date: dateFmt.format(item.updatedAt) }) : t("draftEdited", { date: dateFmt.format(item.updatedAt) })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {totalDrafts > report.drafts.length && <p className="mt-1 text-xs text-slate-500">{t("listCapped", { shown: fmt(report.drafts.length), total: fmt(totalDrafts) })}</p>}
        </section>
      </div>

      <section className="mt-10">
        <h2 className="mb-1 text-sm font-medium text-slate-900">{t("gapsTitle")}</h2>
        <p className="mb-3 text-xs text-slate-500">
          {t("gapsHelp")}
          {coverage !== null && <> {t("gapsCoverage", { percent: coverage, withGuide: fmt(report.modelsWithGuide), onSite: fmt(report.modelsOnSite) })}</>}
        </p>
        {/* Le conteneur défilant est « relative » : le texte sr-only (position absolue) de la dernière colonne doit y rester, sinon il élargit toute la page. */}
        {report.gaps.length === 0 ? (
          <p className="text-sm text-slate-500">{t("gapsEmpty")}</p>
        ) : (
          <div className="relative overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start font-medium">{t("colModel")}</th>
                  <th scope="col" className="px-3 py-2 text-end font-medium">{t("colListings")}</th>
                  <th scope="col" className="px-3 py-2 text-end font-medium">{t("colViews")}</th>
                  <th scope="col" className="px-3 py-2 text-end font-medium">{t("colRoadTests")}</th>
                  <th scope="col" className="px-3 py-2 text-end font-medium">{t("colPress")}</th>
                  <th scope="col" className="px-3 py-2 text-end font-medium">
                    <span className="sr-only">{t("colAction")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.gaps.map((m) => (
                  <tr key={m.modelId}>
                    <th scope="row" className="px-3 py-2 text-start font-normal">
                      <Link href={`/voitures/${m.brandSlug}/${m.modelSlug}`} className="text-slate-900 hover:underline">
                        {m.brandName} {m.modelName}
                      </Link>
                    </th>
                    <td className="px-3 py-2 text-end tabular-nums">{fmt(m.listings)}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{fmt(m.views)}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{fmt(m.roadTests)}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{fmt(m.pressReviews)}</td>
                    <td className="px-3 py-2 text-end">
                      <Link href={`/admin/guides/nouveau?modele=${m.modelId}`} className="text-slate-900 underline hover:text-slate-700">
                        {t("writeGuide")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-10 space-y-1 text-xs text-slate-500">
        <p>{t("noteTargets")}</p>
        <p>{t("noteWeeks")}</p>
      </div>
    </div>
  );
}

function SectionCard({
  s,
  label,
  t,
  dateFmt,
  fmt,
}: {
  s: SectionSummary;
  label: string;
  t: Awaited<ReturnType<typeof getTranslations<"AdminEditorial">>>;
  dateFmt: Intl.DateTimeFormat;
  fmt: (n: number) => string;
}) {
  const f = s.freshness;
  const pill =
    f.status === "ok"
      ? { text: t("statusOk"), cls: "bg-emerald-100 text-emerald-800" }
      : f.status === "late"
        ? { text: t("statusLate"), cls: "bg-amber-100 text-amber-800" }
        : { text: t("statusEmpty"), cls: "bg-slate-100 text-slate-600" };

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium text-slate-900">{label}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs ${pill.cls}`}>{pill.text}</span>
      </div>
      <p className="mt-2 text-sm text-slate-700">
        {f.status === "empty"
          ? t("nothingPublished")
          : t("lastPublished", { date: dateFmt.format(s.lastPublishedAt!), days: f.daysSince })}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {f.status === "late" ? t("overdue", { days: f.overdueBy, target: fmt(s.targetDays) }) : t("target", { target: fmt(s.targetDays) })}
      </p>
      <p className="mt-3 text-xs text-slate-500">
        {t("counts", { published: fmt(s.published), scheduled: fmt(s.scheduled), drafts: fmt(s.drafts) })}
      </p>
      <div className="mt-3 flex gap-4 text-sm">
        <Link href={ADMIN_BASE[s.section]} className="text-slate-900 underline hover:text-slate-700">
          {t("manage")}
        </Link>
        {s.section !== "press" && (
          <Link href={`${ADMIN_BASE[s.section]}/nouveau`} className="text-slate-700 underline hover:text-slate-900">
            {t("createNew")}
          </Link>
        )}
      </div>
    </div>
  );
}
