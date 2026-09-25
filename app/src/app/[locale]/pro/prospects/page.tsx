import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { canManageProListings } from "@/lib/pro-account";
import { resolveProAccess } from "@/lib/pro-access";
import { loadProspects } from "@/lib/prospects-data";
import { PROSPECT_STATUSES, parseProspectStatusFilter, type ProspectStatusValue } from "@/lib/prospects";
import { ProspectEditor } from "@/components/ProspectEditor";
import { CallbackEditor } from "@/components/CallbackEditor";
import { prisma } from "@/lib/prisma";

// Lot 123 — suivi des prospects du compte professionnel : les personnes identifiées qui ont écrit à
// propos d'une annonce, avec un statut et une note privée. Réservé au propriétaire et aux
// collaborateurs qui peuvent gérer les annonces : ce sont les seuls à pouvoir lire ces conversations.
export default async function ProProspectsPage({ searchParams }: { searchParams: Promise<{ statut?: string | string[]; annonce?: string | string[] }> }) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("ProProspects");
  const tPro = await getTranslations("Pro");
  const tCallback = await getTranslations("CallbackRequest");
  const resolved = await resolveProAccess(user);
  if (!resolved) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="mb-4 text-slate-600 dark:text-slate-300">{tPro("noAccountYet")}</p>
        <Link href="/devenir-professionnel" className="text-sm text-slate-900 dark:text-slate-100 underline">
          {tPro("becomeProLink")}
        </Link>
      </div>
    );
  }
  if (!canManageProListings(resolved.access)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-600 dark:text-slate-300">{tPro("forbidden")}</p>
      </div>
    );
  }

  const query = await searchParams;
  const status = parseProspectStatusFilter(query.statut);
  const rawListing = Array.isArray(query.annonce) ? query.annonce[0] : query.annonce;
  const [report, callbackRequests] = await Promise.all([
    loadProspects(resolved.account.userId, { listingId: rawListing || null, status }),
    prisma.callbackRequest.findMany({
      where: { proAccountId: resolved.account.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { listing: { select: { id: true, title: true } } },
    }),
  ]);
  // Un identifiant d'annonce inconnu ou étranger au compte n'est pas retenu comme filtre.
  const listingFilter = report.listings.some((l) => l.id === rawListing) ? (rawListing as string) : null;

  const numberLocale = locale === "ar" ? "ar-DZ" : "fr-DZ";
  const fmtDate = (d: Date) => d.toLocaleDateString(numberLocale, { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Algiers" });
  const hrefWith = (next: { statut?: ProspectStatusValue | null }) => {
    const params = new URLSearchParams();
    if (next.statut) params.set("statut", next.statut);
    if (listingFilter) params.set("annonce", listingFilter);
    const qs = params.toString();
    return `/pro/prospects${qs ? `?${qs}` : ""}`;
  };
  const totalForListing = PROSPECT_STATUSES.reduce((sum, s) => sum + report.counts[s], 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/pro/tableau-de-bord" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
        {t("back")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("subtitle")}</p>

      {report.total === 0 ? (
        <p className="mt-10 rounded-lg border border-slate-200 dark:border-slate-700 p-6 text-center text-sm text-slate-600 dark:text-slate-300">{t("empty")}</p>
      ) : (
        <>
          <nav aria-label={t("statusFilterLabel")} className="mt-6 flex flex-wrap gap-2">
            <Link
              href={hrefWith({})}
              aria-current={status === null ? "true" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${status === null ? "border-slate-900 bg-slate-900 dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900 text-white" : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-500 dark:hover:border-slate-400"}`}
            >
              {t("filterAll", { count: totalForListing })}
            </Link>
            {PROSPECT_STATUSES.map((s) => (
              <Link
                key={s}
                href={hrefWith({ statut: s })}
                aria-current={status === s ? "true" : undefined}
                className={`rounded-full border px-3 py-1 text-sm ${status === s ? "border-slate-900 bg-slate-900 dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900 text-white" : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-500 dark:hover:border-slate-400"}`}
              >
                {t(`status${s}` as "statusNOUVEAU")} ({report.counts[s]})
              </Link>
            ))}
          </nav>

          <form method="get" action={`/${locale}/pro/prospects`} className="mt-4 flex flex-wrap items-end gap-2">
            {status && <input type="hidden" name="statut" value={status} />}
            <label className="text-xs text-slate-500 dark:text-slate-400">
              {t("listingFilterLabel")}
              <select name="annonce" defaultValue={listingFilter ?? ""} className="mt-1 block max-w-xs rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-200">
                <option value="">{t("allListings")}</option>
                {report.listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:border-slate-500 dark:hover:border-slate-400">
              {t("applyFilter")}
            </button>
          </form>

          {report.rows.length === 0 ? (
            <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">{t("noResults")}</p>
          ) : (
            <ul className="mt-6 space-y-3">
              {report.rows.map((row) => (
                <li key={row.conversationId} className="grid gap-4 rounded-lg border border-slate-200 dark:border-slate-700 p-4 sm:grid-cols-[1fr_18rem]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{row.buyerName ?? t("anonymousBuyer")}</p>
                      {row.awaitingReply && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{t("awaitingReply")}</span>}
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      <Link href={`/annonce/${row.listing.id}`} className="hover:underline">
                        {row.listing.title}
                      </Link>
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("lastActivity", { date: fmtDate(row.lastActivityAt) })}</p>
                    <Link href={`/compte/messages/${row.conversationId}`} className="mt-3 inline-block text-sm text-slate-700 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-slate-100">
                      {t("openConversation")}
                    </Link>
                  </div>
                  <ProspectEditor conversationId={row.conversationId} initialStatus={row.status} initialNote={row.note} />
                </li>
              ))}
            </ul>
          )}

          {report.truncated && <p className="mt-4 text-xs text-amber-700">{t("truncated")}</p>}
          <p className="mt-10 text-xs text-slate-500 dark:text-slate-400">{t("noteDefinition")}</p>
        </>
      )}

      {/* Lot 160 — Demandes de rappel */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{tCallback("sectionTitle")}</h2>
        {callbackRequests.length === 0 ? (
          <p className="rounded-lg border border-slate-200 dark:border-slate-700 p-6 text-center text-sm text-slate-600 dark:text-slate-300">
            {tCallback("sectionEmpty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {callbackRequests.map((req) => (
              <li key={req.id} className="grid gap-4 rounded-lg border border-slate-200 dark:border-slate-700 p-4 sm:grid-cols-[1fr_14rem]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{req.callerName}</span>
                    <a href={`tel:${req.callerPhone}`} className="text-sm text-slate-700 dark:text-slate-300 hover:underline">{req.callerPhone}</a>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{tCallback(`preferredTime${req.preferredTime}` as "preferredTimeMATIN")}</span>
                  </div>
                  {req.listing && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      <Link href={`/annonce/${req.listing.id}`} className="hover:underline">
                        {req.listing.title}
                      </Link>
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {tCallback("requestedAt")} {fmtDate(req.createdAt)}
                  </p>
                </div>
                <CallbackEditor
                  requestId={req.id}
                  initialStatus={req.status}
                  initialNote={req.note}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
