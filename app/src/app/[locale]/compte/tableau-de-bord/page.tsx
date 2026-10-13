import Image from "next/image";
import { getTranslations, getLocale } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { LogoutButton } from "@/components/LogoutButton";
import { EmailVerificationStatus } from "@/components/EmailVerificationStatus";
import { PhoneVerificationStatus } from "@/components/PhoneVerificationStatus";
import { IdentityVerificationStatus } from "@/components/IdentityVerificationStatus";
import { OwnResponsiveness } from "@/components/OwnResponsiveness";
import { getSellerResponsiveness } from "@/lib/seller-responsiveness-service";
import { loadSellerStats } from "@/lib/seller-stats";
import { DailyBars } from "@/components/DailyBars";

export default async function DashboardPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null; // inatteignable — redirect() lève toujours ; satisfait le contrôle de flux TS
  }

  const t = await getTranslations("Dashboard");
  const tNav = await getTranslations("Nav");

  const tStats = await getTranslations("SellerStats");
  const tVisit = await getTranslations("VisitRequest");
  const [stats, pendingVisitCount] = await Promise.all([
    loadSellerStats(user.id, 30),
    prisma.visitRequest.count({ where: { sellerId: user.id, status: "EN_ATTENTE" } }),
  ]);

  const isPro = user.role === "PROFESSIONNEL" || user.role === "MODERATEUR" || user.role === "ADMIN";
  const latestIdentityRequest = isPro && !user.identityVerifiedAt
    ? await prisma.identityVerificationRequest.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const roleLabel = user.role === "PARTICULIER" ? t("roleParticulier") : user.role;
  const wilayaLabel = user.profile?.wilaya
    ? locale === "ar"
      ? user.profile.wilaya.nomAr
      : user.profile.wilaya.nomFr
    : t("notProvided");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center gap-3 mb-6">
        {user.profile?.avatarUrl ? (
          <div className="relative h-12 w-12 shrink-0">
            <Image
              src={user.profile.avatarUrl}
              alt=""
              fill
              sizes="48px"
              className="rounded-full object-cover border border-slate-200 dark:border-slate-600"
            />
          </div>
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600" />
        )}
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t("welcome", { name: user.profile?.displayName ?? user.email })}
        </h1>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
        <h2 className="px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">{t("accountInfo")}</h2>
        <Row label={t("email")} value={user.email} />
        <Row label={t("role")} value={roleLabel} />
        <Row label={t("wilaya")} value={wilayaLabel} />
        <Row
          label={t("memberSince")}
          value={new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
            dateStyle: "long",
          }).format(user.createdAt)}
        />
        <Row label={t("phone")} value={user.phone ?? t("notProvided")} />
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-4">
        <EmailVerificationStatus verified={Boolean(user.emailVerifiedAt)} />
        <PhoneVerificationStatus verified={Boolean(user.phoneVerifiedAt)} hasPhone={Boolean(user.phone)} />
        {isPro && (
          <IdentityVerificationStatus
            verified={Boolean(user.identityVerifiedAt)}
            pending={latestIdentityRequest?.status === "EN_ATTENTE"}
            rejectionNote={
              latestIdentityRequest?.status === "REFUSEE" ? latestIdentityRequest.reviewNote : null
            }
          />
        )}
      </div>

      <OwnResponsiveness responsiveness={await getSellerResponsiveness(user.id)} />

      {(stats.totalViews > 0 || stats.activeListings > 0) && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">{tStats("sectionTitle")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label={tStats("views")} value={stats.totalViews} />
            <KpiCard label={tStats("favorites")} value={stats.totalFavorites} />
            <KpiCard label={tStats("offers")} value={stats.totalOffers} />
            <KpiCard label={tStats("activeListings")} value={stats.activeListings} />
          </div>
          {stats.viewsSeries.some((p) => p.value > 0) && (
            <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{tStats("viewsChart")}</p>
              <DailyBars points={stats.viewsSeries} label={tStats("viewsChart")} locale={locale} barClass="bg-sky-500" />
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center gap-4 flex-wrap">
        <Link
          href="/compte/mes-annonces"
          className="rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          {tNav("myListings")}
        </Link>
        <Link
          href="/compte/activite"
          className="rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          {t("activityLink")}
        </Link>
        <Link
          href="/compte/offres"
          className="rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          {t("offresLink")}
        </Link>
        <Link
          href="/compte/visites"
          className="rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          {tVisit("visitsPageTitle")}
          {pendingVisitCount > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-xs font-medium text-white">
              {pendingVisitCount}
            </span>
          )}
        </Link>
        <Link href="/compte/profil" className="text-sm text-slate-700 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-slate-100">
          {t("editProfileLink")}
        </Link>
        {user.professionalAccount ? (
          <Link href="/pro/tableau-de-bord" className="text-sm text-slate-700 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-slate-100">
            {t("proDashboardLink")}
          </Link>
        ) : (
          user.role === "PARTICULIER" && (
            <Link href="/devenir-professionnel" className="text-sm text-slate-700 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-slate-100">
              {t("becomeProLink")}
            </Link>
          )
        )}
        <LogoutButton label={t("logout")} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex justify-between text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-slate-900 dark:text-slate-100 font-medium">{value}</span>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-center">
      <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
