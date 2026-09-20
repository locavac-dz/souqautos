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

export default async function DashboardPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null; // inatteignable — redirect() lève toujours ; satisfait le contrôle de flux TS
  }

  const t = await getTranslations("Dashboard");
  const tNav = await getTranslations("Nav");

  const latestIdentityRequest = user.identityVerifiedAt
    ? null
    : await prisma.identityVerificationRequest.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

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
              className="rounded-full object-cover border border-slate-200"
            />
          </div>
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-full bg-slate-100 border border-slate-200" />
        )}
        <h1 className="text-2xl font-semibold text-slate-900">
          {t("welcome", { name: user.profile?.displayName ?? user.email })}
        </h1>
      </div>

      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
        <h2 className="px-4 py-3 text-sm font-medium text-slate-500">{t("accountInfo")}</h2>
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

      <div className="mt-6 rounded-lg border border-slate-200 p-4 space-y-4">
        <EmailVerificationStatus verified={Boolean(user.emailVerifiedAt)} />
        <PhoneVerificationStatus verified={Boolean(user.phoneVerifiedAt)} hasPhone={Boolean(user.phone)} />
        <IdentityVerificationStatus
          verified={Boolean(user.identityVerifiedAt)}
          pending={latestIdentityRequest?.status === "EN_ATTENTE"}
          rejectionNote={
            latestIdentityRequest?.status === "REFUSEE" ? latestIdentityRequest.reviewNote : null
          }
        />
      </div>

      <OwnResponsiveness responsiveness={await getSellerResponsiveness(user.id)} />

      <div className="mt-6 flex items-center gap-4">
        <Link
          href="/compte/mes-annonces"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          {tNav("myListings")}
        </Link>
        <Link href="/compte/profil" className="text-sm text-slate-700 underline hover:text-slate-900">
          {t("editProfileLink")}
        </Link>
        {user.professionalAccount ? (
          <Link href="/pro/tableau-de-bord" className="text-sm text-slate-700 underline hover:text-slate-900">
            {t("proDashboardLink")}
          </Link>
        ) : (
          user.role === "PARTICULIER" && (
            <Link href="/devenir-professionnel" className="text-sm text-slate-700 underline hover:text-slate-900">
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
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium">{value}</span>
    </div>
  );
}
