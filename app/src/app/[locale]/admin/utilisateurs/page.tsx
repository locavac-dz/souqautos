import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin, isStaff } from "@/lib/auth-server/roles";
import { RoleSelect } from "@/components/admin/RoleSelect";
import { SuspendUserButton } from "@/components/admin/SuspendUserButton";

const ROLE_KEY: Record<string, string> = {
  PARTICULIER: "roleOptionParticulier",
  PROFESSIONNEL: "roleOptionProfessionnel",
  MODERATEUR: "roleOptionModerateur",
  ADMIN: "roleOptionAdmin",
};

export default async function AdminUsersPage() {
  const t = await getTranslations("Admin");
  const currentUser = await getCurrentUser();
  const canChangeRoles = Boolean(currentUser && isAdmin(currentUser.role));
  const canSuspend = Boolean(currentUser && isStaff(currentUser.role));

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { profile: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">{t("navUsers")}</h1>
      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
        {users.map((user) => (
          <div key={user.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-slate-900">{user.profile?.displayName ?? user.email}</p>
              <p className="text-slate-400 text-xs">{user.email}</p>
              {user.suspendedAt && (
                <p className="mt-0.5 text-xs text-red-600">
                  {t("suspendedLabel")}
                  {user.suspensionReason && ` — ${t("suspensionReasonLabel", { reason: user.suspensionReason })}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {canChangeRoles ? (
                <RoleSelect userId={user.id} currentRole={user.role} disabled={user.id === currentUser?.id} />
              ) : (
                <span className="text-slate-600">{t(ROLE_KEY[user.role])}</span>
              )}
              {canSuspend && !isStaff(user.role) && user.id !== currentUser?.id && (
                <SuspendUserButton userId={user.id} suspended={Boolean(user.suspendedAt)} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
