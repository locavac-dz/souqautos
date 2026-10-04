import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { getTwoFactorStatus } from "@/lib/two-factor";
import { isStaffRole, staffTwoFactorRequired } from "@/lib/staff-two-factor";
import { TwoFactorPanel } from "@/components/TwoFactorPanel";
import { getLoginHistory } from "@/lib/login-event-service";

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
  const tH = await getTranslations("LoginHistory");
  const format = await getFormatter();
  const [status, loginHistory, real] = await Promise.all([
    getTwoFactorStatus(user.id),
    getLoginHistory(user.id, 10),
    prisma.user.findUnique({ where: { id: user.id }, select: { role: true } }),
  ]);
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

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{tH("title")}</h2>
        {loginHistory.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{tH("empty")}</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {loginHistory.map((event) => (
              <li key={event.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {event.browser}{event.os ? ` — ${event.os}` : ""}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {event.ip} · {tH(`method.${event.method}`)} ·{" "}
                    {format.dateTime(event.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                  event.success
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                }`}>
                  {event.success ? tH("success") : tH("failure")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
