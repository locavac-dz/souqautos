import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isModerator } from "@/lib/auth-server/roles";
import { bucketByWeek } from "@/lib/product-stats";

const WEEKS = 12;
// Lot 279 (audit C4) — seules les 12 dernières semaines sont lues (plus jamais la table entière), et la note moyenne
// vient d'un agrégat SQL.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const STATUS_ORDER = ["EN_ATTENTE", "PUBLIEE", "REFUSEE", "SUSPENDUE", "VENDUE", "EXPIREE", "BROUILLON"] as const;

// Isolée du composant : la règle de pureté de React interdit un appel à Date.now() dans le corps du composant.
function weeksAgo(weeks: number): Date {
  return new Date(Date.now() - (weeks + 1) * WEEK_MS);
}

export default async function AdminStatisticsPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isModerator(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }
  const t = await getTranslations("Admin");
  const tStatus = await getTranslations("Status");

  const since = weeksAgo(WEEKS);
  const [
    users,
    listings,
    statusGroups,
    brandGroups,
    wilayaGroups,
    reviewAggregate,
    confirmedReportCount,
    conversationCount,
  ] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.listing.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.listing.groupBy({ by: ["status"], _count: true }),
    prisma.listing.groupBy({
      by: ["brandId"],
      where: { status: "PUBLIEE", brandId: { not: null } },
      _count: true,
      orderBy: { _count: { brandId: "desc" } },
      take: 5,
    }),
    prisma.listing.groupBy({
      by: ["wilayaId"],
      where: { status: "PUBLIEE" },
      _count: true,
      orderBy: { _count: { wilayaId: "desc" } },
      take: 5,
    }),
    prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
    prisma.report.count({ where: { status: "TRAITE" } }),
    prisma.conversation.count(),
  ]);

  const [brands, wilayas] = await Promise.all([
    prisma.brand.findMany({ where: { id: { in: brandGroups.map((g) => g.brandId!) } } }),
    prisma.wilaya.findMany({ where: { id: { in: wilayaGroups.map((g) => g.wilayaId) } } }),
  ]);
  const brandNameById = new Map(brands.map((b) => [b.id, b.name]));
  const wilayaLabelById = new Map(wilayas.map((w) => [w.id, locale === "ar" ? w.nomAr : w.nomFr]));

  const userWeeks = bucketByWeek(
    users.map((u) => u.createdAt),
    WEEKS
  );
  const listingWeeks = bucketByWeek(
    listings.map((l) => l.createdAt),
    WEEKS
  );

  const statusCounts = new Map(statusGroups.map((g) => [g.status, g._count]));
  const maxStatusCount = Math.max(1, ...statusGroups.map((g) => g._count));
  const maxUserWeek = Math.max(1, ...userWeeks.map((w) => w.count));
  const maxListingWeek = Math.max(1, ...listingWeeks.map((w) => w.count));
  const maxBrandCount = Math.max(1, ...brandGroups.map((g) => g._count));
  const maxWilayaCount = Math.max(1, ...wilayaGroups.map((g) => g._count));

  const reviewCount = reviewAggregate._count._all;
  const avgRating = Math.round((reviewAggregate._avg.rating ?? 0) * 10) / 10;

  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">{t("statisticsTitle")}</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <SummaryCard label={t("statSummaryConversations")} value={conversationCount} />
        <SummaryCard label={t("statSummaryReviews")} value={reviewCount} />
        <SummaryCard
          label={t("statSummaryAvgRating")}
          value={reviewCount > 0 ? avgRating.toFixed(1) : "—"}
        />
        <SummaryCard label={t("statSummaryConfirmedReports")} value={confirmedReportCount} />
      </div>

      <section className="mb-10">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          {t("statNewUsersTitle", { weeks: WEEKS })}
        </h2>
        <WeekBars weeks={userWeeks} max={maxUserWeek} formatter={dateFormatter} />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          {t("statNewListingsTitle", { weeks: WEEKS })}
        </h2>
        <WeekBars weeks={listingWeeks} max={maxListingWeek} formatter={dateFormatter} />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t("statStatusBreakdownTitle")}</h2>
        <div className="space-y-2">
          {STATUS_ORDER.map((status) => {
            const count = statusCounts.get(status) ?? 0;
            return (
              <BarRow
                key={status}
                label={tStatus(status)}
                count={count}
                max={maxStatusCount}
                barClassName="bg-slate-700"
              />
            );
          })}
        </div>
      </section>

      <div className="grid sm:grid-cols-2 gap-10">
        <section>
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t("statTopBrandsTitle")}</h2>
          {brandGroups.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("statNoData")}</p>
          ) : (
            <div className="space-y-2">
              {brandGroups.map((g) => (
                <BarRow
                  key={g.brandId}
                  label={brandNameById.get(g.brandId!) ?? "—"}
                  count={g._count}
                  max={maxBrandCount}
                  barClassName="bg-emerald-600"
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t("statTopWilayasTitle")}</h2>
          {wilayaGroups.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("statNoData")}</p>
          ) : (
            <div className="space-y-2">
              {wilayaGroups.map((g) => (
                <BarRow
                  key={g.wilayaId}
                  label={wilayaLabelById.get(g.wilayaId) ?? "—"}
                  count={g._count}
                  max={maxWilayaCount}
                  barClassName="bg-amber-600"
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1">{value}</p>
    </div>
  );
}

function BarRow({
  label,
  count,
  max,
  barClassName,
}: {
  label: string;
  count: number;
  max: number;
  barClassName: string;
}) {
  const widthPct = Math.round((count / max) * 100);
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0 truncate text-slate-600 dark:text-slate-300">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${widthPct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right font-medium text-slate-900 dark:text-slate-100">{count}</span>
    </div>
  );
}

function WeekBars({
  weeks,
  max,
  formatter,
}: {
  weeks: { weekStart: Date; count: number }[];
  max: number;
  formatter: Intl.DateTimeFormat;
}) {
  return (
    <div className="flex items-end gap-1.5 h-32">
      {weeks.map((w) => {
        const heightPct = Math.max(4, Math.round((w.count / max) * 100));
        return (
          <div key={w.weekStart.toISOString()} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full rounded-t bg-slate-700"
                style={{ height: `${heightPct}%` }}
                title={`${formatter.format(w.weekStart)} — ${w.count}`}
              />
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{w.count}</span>
          </div>
        );
      })}
    </div>
  );
}
