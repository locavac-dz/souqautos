import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isModerator } from "@/lib/auth-server/roles";
import { formatAuditLogDetails } from "@/lib/audit-log";

// Journal d'audit (§47 du cahier d'architecture : « logs d'audit sur toute
// action admin »). AuditLog est alimenté depuis le Lot 7 par une quinzaine de
// routes admin, mais rien ne permettait jusqu'ici de le CONSULTER — un audit
// sans lecture possible ne remplit pas vraiment son rôle de traçabilité.
// Accessible à tout le staff (MODERATEUR compris), comme les autres pages de
// consultation du back-office (référentiels, statistiques) : il n'y a rien à
// éditer ici, seulement à lire.
const PAGE_SIZE = 30;

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isModerator(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const t = await getTranslations("AdminAuditLog");

  const [entries, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { admin: { select: { email: true } } },
    }),
    prisma.auditLog.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  function hrefForPage(p: number): string {
    return p > 1 ? `/admin/journal?page=${p}` : "/admin/journal";
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{t("title")}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t("subtitle")}</p>

      {entries.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-4">{t("colDate")}</th>
                <th className="py-2 pr-4">{t("colAdmin")}</th>
                <th className="py-2 pr-4">{t("colAction")}</th>
                <th className="py-2 pr-4">{t("colTarget")}</th>
                <th className="py-2">{t("colDetails")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 dark:border-slate-700 align-top">
                  <td className="py-2 pr-4 whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {dateFormatter.format(entry.createdAt)}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">{entry.admin?.email ?? t("systemActor")}</td>
                  <td className="py-2 pr-4 whitespace-nowrap font-mono text-xs text-slate-700 dark:text-slate-300">
                    {entry.action}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {entry.targetType} · {entry.targetId.slice(0, 10)}…
                  </td>
                  <td className="py-2 text-slate-600 dark:text-slate-300">{formatAuditLogDetails(entry.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label={t("paginationLabel")} className="mt-6 flex items-center justify-center gap-4">
          {page > 1 ? (
            <Link href={hrefForPage(page - 1)} className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:underline">
              <span aria-hidden="true" className="rtl:hidden">← </span>
              <span aria-hidden="true" className="ltr:hidden">→ </span>
              {t("previous")}
            </Link>
          ) : (
            <span aria-disabled="true" className="text-sm text-slate-500 dark:text-slate-400">
              <span aria-hidden="true" className="rtl:hidden">← </span>
              <span aria-hidden="true" className="ltr:hidden">→ </span>
              {t("previous")}
            </span>
          )}
          <span className="text-sm text-slate-500 dark:text-slate-400">{t("pageOf", { page, totalPages })}</span>
          {page < totalPages ? (
            <Link href={hrefForPage(page + 1)} className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:underline">
              {t("next")}
              <span aria-hidden="true" className="rtl:hidden"> →</span>
              <span aria-hidden="true" className="ltr:hidden"> ←</span>
            </Link>
          ) : (
            <span aria-disabled="true" className="text-sm text-slate-500 dark:text-slate-400">
              {t("next")}
              <span aria-hidden="true" className="rtl:hidden"> →</span>
              <span aria-hidden="true" className="ltr:hidden"> ←</span>
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
