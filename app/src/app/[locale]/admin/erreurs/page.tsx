import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { pageWindow, parseRequestedPage } from "@/lib/pagination";
import { Pagination } from "@/components/search/Pagination";
import type { ErrorLogKind } from "@/lib/error-log";

const PAGE_SIZE = 50;

const KIND_COLORS: Record<ErrorLogKind, string> = {
  server: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  client: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  csp: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; kind?: string }>;
}) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }

  const t = await getTranslations("AdminErrors");
  const { page: rawPage, kind: rawKind } = await searchParams;

  const kindFilter = rawKind && ["server", "client", "csp"].includes(rawKind) ? rawKind : undefined;
  const where = kindFilter ? { kind: kindFilter } : {};

  const totalCount = await prisma.errorLog.count({ where });
  const { page, totalPages, skip } = pageWindow(totalCount, parseRequestedPage(rawPage), PAGE_SIZE);

  const errors = await prisma.errorLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: PAGE_SIZE,
  });

  const counts = await prisma.errorLog.groupBy({
    by: ["kind"],
    _count: true,
  });
  const countByKind: Record<string, number> = {};
  for (const c of counts) countByKind[c.kind] = c._count;

  const filterParams = kindFilter ? { kind: kindFilter } : {};

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
        {t("title")} ({totalCount})
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t("subtitle")}</p>

      <div className="flex flex-wrap gap-2 mb-6">
        <KindFilter label={t("filterAll")} count={Object.values(countByKind).reduce((a, b) => a + b, 0)} active={!kindFilter} />
        <KindFilter label={t("filterServer")} count={countByKind["server"] ?? 0} kind="server" active={kindFilter === "server"} />
        <KindFilter label={t("filterClient")} count={countByKind["client"] ?? 0} kind="client" active={kindFilter === "client"} />
        <KindFilter label={t("filterCsp")} count={countByKind["csp"] ?? 0} kind="csp" active={kindFilter === "csp"} />
      </div>

      {errors.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t("empty")}</p>
      ) : (
        <div className="space-y-2">
          {errors.map((err) => (
            <div
              key={err.id}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${KIND_COLORS[err.kind as ErrorLogKind] ?? ""}`}>
                      {err.kind}
                    </span>
                    {err.context && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">{err.context}</span>
                    )}
                    {err.statusCode && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">{err.statusCode}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words">
                    {err.message}
                  </p>
                  {err.route && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {err.method && `${err.method} `}{err.route}
                    </p>
                  )}
                  {err.stack && (
                    <details className="mt-2">
                      <summary className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
                        Stack trace
                      </summary>
                      <pre className="mt-1 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words bg-slate-50 dark:bg-slate-800/50 rounded p-2 max-h-48 overflow-y-auto">
                        {err.stack}
                      </pre>
                    </details>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <time className="text-xs text-slate-500 dark:text-slate-400" dateTime={err.createdAt.toISOString()}>
                    {err.createdAt.toLocaleDateString(locale === "ar" ? "ar-DZ" : "fr-DZ", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                    {err.fingerprint.slice(0, 8)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} searchParams={filterParams} basePath="/admin/erreurs" />
    </div>
  );
}

function KindFilter({
  label,
  count,
  kind,
  active,
}: {
  label: string;
  count: number;
  kind?: string;
  active: boolean;
}) {
  const href = kind ? `/admin/erreurs?kind=${kind}` : "/admin/erreurs";
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20 dark:bg-slate-900/20" : "bg-slate-200 dark:bg-slate-700"}`}>
        {count}
      </span>
    </a>
  );
}
