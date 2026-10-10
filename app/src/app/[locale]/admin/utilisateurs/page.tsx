import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin, isStaff, isModerator, isSuperAdmin } from "@/lib/auth-server/roles";
import { RoleSelect } from "@/components/admin/RoleSelect";
import { SuspendUserButton } from "@/components/admin/SuspendUserButton";
import { UnlockUserButton } from "@/components/admin/UnlockUserButton";
import { ResetTwoFactorButton } from "@/components/admin/ResetTwoFactorButton";
import { isAccountLocked } from "@/lib/login-lockout";
import { pageWindow, parseRequestedPage } from "@/lib/pagination";
import { Pagination } from "@/components/search/Pagination";

// Lot 279 (audit C4) — la liste des comptes était chargée en entier ; 50 par page, même mécanique que les listes publiques.
const USERS_PAGE_SIZE = 50;

const ROLE_KEY: Record<string, string> = {
  PARTICULIER: "roleOptionParticulier",
  PROFESSIONNEL: "roleOptionProfessionnel",
  MODERATEUR: "roleOptionModerateur",
  SUPPORT: "roleOptionSupport",
  EDITEUR: "roleOptionEditeur",
  ADMIN: "roleOptionAdmin",
  SUPER_ADMIN: "roleOptionSuperAdmin",
};

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const locale = await getLocale();
  const currentUser = await getCurrentUser();
  if (!currentUser || !isModerator(currentUser.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }
  const t = await getTranslations("Admin");
  const tTwoFactor = await getTranslations("TwoFactor");
  const canChangeRoles = isAdmin(currentUser.role);
  const canAssignSuperAdmin = isSuperAdmin(currentUser.role);
  const canSuspend = isStaff(currentUser.role);

  const { page: rawPage } = await searchParams;
  const totalCount = await prisma.user.count();
  const { page, totalPages, skip } = pageWindow(totalCount, parseRequestedPage(rawPage), USERS_PAGE_SIZE);
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { profile: true },
    skip,
    take: USERS_PAGE_SIZE,
  });
  const now = new Date();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">{t("navUsers")} ({totalCount})</h1>
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
                        canAssignSuperAdmin={canAssignSuperAdmin}
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
      <Pagination page={page} totalPages={totalPages} searchParams={{}} basePath="/admin/utilisateurs" />
    </div>
  );
}
