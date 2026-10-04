import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isModerator } from "@/lib/auth-server/roles";
import { ToggleProVerifiedButton } from "@/components/admin/ToggleProVerifiedButton";

export default async function AdminProAccountsPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isModerator(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }
  const t = await getTranslations("Admin");

  const accounts = await prisma.professionalAccount.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
        {t("proAccounts")} ({accounts.length})
      </h1>
      {accounts.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t("noProAccounts")}</p>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3"
            >
              <div>
                <Link href={`/pro/${account.id}`} className="font-medium text-slate-900 dark:text-slate-100 hover:underline">
                  {account.nomCommercial}
                </Link>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{account.user.email}</p>
              </div>
              <ToggleProVerifiedButton accountId={account.id} verified={account.badgeVerifie} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
