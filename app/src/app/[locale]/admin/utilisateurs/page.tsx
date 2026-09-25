import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin, isStaff } from "@/lib/auth-server/roles";
import { RoleSelect } from "@/components/admin/RoleSelect";
import { SuspendUserButton } from "@/components/admin/SuspendUserButton";
import { UnlockUserButton } from "@/components/admin/UnlockUserButton";
import { ResetTwoFactorButton } from "@/components/admin/ResetTwoFactorButton";
import { isAccountLocked } from "@/lib/login-lockout";

const ROLE_KEY: Record<string, string> = {
  PARTICULIER: "roleOptionParticulier",
  PROFESSIONNEL: "roleOptionProfessionnel",
  MODERATEUR: "roleOptionModerateur",
  ADMIN: "roleOptionAdmin",
};

export default async function AdminUsersPage() {
  const t = await getTranslations("Admin");
  const tTwoFactor = await getTranslations("TwoFactor");
  const currentUser = await getCurrentUser();
  const canChangeRoles = Boolean(currentUser && isAdmin(currentUser.role));
  const canSuspend = Boolean(currentUser && isStaff(currentUser.role));

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { profile: true },
  });
  const now = new Date();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">{t("navUsers")}</h1>
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
        {users.map((user) => {
          const locked = isAccountLocked(user.lockedUntil, now);
          return (
            <div key={user.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">{user.profile?.displayName ?? user.email}</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs">{user.email}</p>
                {user.totpEnabledAt && <p className="mt-0.5 text-xs text-emerald-700">{tTwoFactor("adminColumn")} : {tTwoFactor("adminEnabled")}</p>}
                {user.deletedAt ? (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t("deletedLabel")}</p>
                ) : (
                  <>
                    {user.suspendedAt && (
                      <p className="mt-0.5 text-xs text-red-600">
                        {t("suspendedLabel")}
                        {user.suspensionReason && ` — ${t("suspensionReasonLabel", { reason: user.suspensionReason })}`}
                      </p>
                    )}
                    {locked && <p className="mt-0.5 text-xs text-amber-600">{t("lockedLabel")}</p>}
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                {user.deletedAt ? (
                  <span className="text-slate-500 dark:text-slate-400">{t(ROLE_KEY[user.role])}</span>
                ) : (
                  <>
                    {canChangeRoles ? (
                      <RoleSelect
                        userId={user.id}
                        currentRole={user.role}
                        disabled={user.id === currentUser?.id}
                        label={t("roleSelectLabel", { name: user.profile?.displayName ?? user.email })}
                      />
                    ) : (
                      <span className="text-slate-600 dark:text-slate-300">{t(ROLE_KEY[user.role])}</span>
                    )}
                    {canSuspend && locked && <UnlockUserButton userId={user.id} />}
                    {canChangeRoles && user.totpEnabledAt && user.id !== currentUser?.id && <ResetTwoFactorButton userId={user.id} />}
                    {canSuspend && !isStaff(user.role) && user.id !== currentUser?.id && (
                      <SuspendUserButton userId={user.id} suspended={Boolean(user.suspendedAt)} />
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
