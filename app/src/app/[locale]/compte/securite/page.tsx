import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { getTwoFactorStatus } from "@/lib/two-factor";
import { isStaffRole, staffTwoFactorRequired } from "@/lib/staff-two-factor";
import { TwoFactorPanel } from "@/components/TwoFactorPanel";

// Lot 138 — « Sécurité du compte » : la double authentification. Espace personnel, jamais indexé (robots.txt : « /*/compte »).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountSecurityPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("TwoFactor");
  const format = await getFormatter();
  const status = await getTwoFactorStatus(user.id);
  // Le rôle RÉEL (getCurrentUser rend un rôle « effectif » : un compte d'équipe sans double authentification y est un simple particulier).
  const real = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  const staffMustEnable = Boolean(real && isStaffRole(real.role) && staffTwoFactorRequired(process.env) && !status.enabled);

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{t("pageTitle")}</h1>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-6">
        {status.enabled ? t("statusOn") : t("statusOff")}
        {status.enabledAt && <span className="text-slate-500 dark:text-slate-400"> — {t("enabledSince", { date: format.dateTime(status.enabledAt, { dateStyle: "long" }) })}</span>}
      </p>
      {staffMustEnable && (
        <p role="status" className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("staffRequired")}
        </p>
      )}
      <TwoFactorPanel status={{ enabled: status.enabled, enabledAt: status.enabledAt ? status.enabledAt.toISOString() : null, recoveryCodesRemaining: status.recoveryCodesRemaining }} hasPassword={Boolean(user.passwordHash)} />
    </div>
  );
}
