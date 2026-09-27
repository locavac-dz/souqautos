import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { canManageProListings } from "@/lib/pro-account";
import { parseProPermissions, type ProPermissions } from "@/lib/pro-permissions";
import { BulkImportForm } from "@/components/BulkImportForm";

export default async function BulkImportPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("BulkImport");
  const tPro = await getTranslations("Pro");

  let account = user.professionalAccount;
  const isOwner = Boolean(account);
  let permissions: ProPermissions | null = null;

  if (!account) {
    const collaboration = await prisma.proCollaborator.findFirst({
      where: { userId: user.id },
      include: { professionalAccount: true },
    });
    if (collaboration) {
      account = collaboration.professionalAccount;
      permissions = parseProPermissions(collaboration.permissions);
    }
  }

  if (!account || !canManageProListings({ isOwner, permissions })) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-600 dark:text-slate-300">{tPro("forbidden")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{t("title")}</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{t("subtitle")}</p>
      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 mb-6 text-xs text-slate-500 dark:text-slate-400">
        <p className="font-medium mb-1">{t("columnsTitle")}</p>
        <p className="font-mono break-words">{t("columnsList")}</p>
      </div>

      <BulkImportForm accountId={account.id} />
    </div>
  );
}
