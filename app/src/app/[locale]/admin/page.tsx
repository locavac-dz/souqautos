import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  const t = await getTranslations("Admin");

  const [pendingCount, publishedCount, userCount, openReportsCount, unverifiedProCount, pendingIdentityCount] =
    await Promise.all([
      prisma.listing.count({ where: { status: "EN_ATTENTE" } }),
      prisma.listing.count({ where: { status: "PUBLIEE" } }),
      prisma.user.count(),
      prisma.report.count({ where: { status: "OUVERT" } }),
      prisma.professionalAccount.count({ where: { badgeVerifie: false } }),
      prisma.identityVerificationRequest.count({ where: { status: "EN_ATTENTE" } }),
    ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">{t("dashboardTitle")}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
        <StatCard label={t("pendingListings")} value={pendingCount} highlight={pendingCount > 0} />
        <StatCard label={t("publishedListings")} value={publishedCount} />
        <StatCard label={t("totalUsers")} value={userCount} />
        <StatCard label={t("openReports")} value={openReportsCount} highlight={openReportsCount > 0} />
        <StatCard label={t("unverifiedProAccounts")} value={unverifiedProCount} highlight={unverifiedProCount > 0} />
        <StatCard
          label={t("pendingIdentityRequests")}
          value={pendingIdentityCount}
          highlight={pendingIdentityCount > 0}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight ? "border-amber-300 bg-amber-50" : "border-slate-200"
      }`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}
