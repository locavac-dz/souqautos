import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { VisitRequestActions } from "@/components/VisitRequestActions";
import type { VisitRequestStatus } from "@prisma/client";

const STATUS_COLOR: Record<VisitRequestStatus, string> = {
  EN_ATTENTE: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  CONFIRMEE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  DECLINEE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  ANNULEE: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  TERMINEE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

export default async function VisitesPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("VisitRequest");
  const dtFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
    dateStyle: "long",
  });
  const timeFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const [received, sent] = await Promise.all([
    prisma.visitRequest.findMany({
      where: { sellerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        listing: { select: { id: true, title: true } },
        buyer: { select: { email: true, profile: { select: { displayName: true } } } },
      },
    }),
    prisma.visitRequest.findMany({
      where: { buyerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        listing: { select: { id: true, title: true } },
        seller: { select: { email: true, profile: { select: { displayName: true } } } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold text-slate-900 dark:text-white">{t("visitsPageTitle")}</h1>

      {/* Demandes reçues (en tant que vendeur) */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">
          {t("sellerLabel")}
        </h2>
        {received.length === 0 ? (
          <p className="text-sm text-slate-500">{t("noVisits")}</p>
        ) : (
          <ul className="space-y-3">
            {received.map((v) => (
              <li key={v.id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <Link
                      href={`/annonce/${v.listing.id}`}
                      className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {v.listing.title}
                    </Link>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t("buyerLabel")} : {v.buyer.profile?.displayName ?? v.buyer.email}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {t("proposedAt", { date: dtFmt.format(v.proposedAt), time: timeFmt.format(v.proposedAt) })}
                    </p>
                    {v.message && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 italic">&ldquo;{v.message}&rdquo;</p>
                    )}
                    {v.sellerNote && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t("sellerNoteLabel")} : {v.sellerNote}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[v.status]}`}>
                      {t(`status${v.status}`)}
                    </span>
                    {v.status === "EN_ATTENTE" && (
                      <VisitRequestActions visitId={v.id} role="seller" />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Demandes envoyées (en tant qu'acheteur) */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">
          {t("buyerLabel")}
        </h2>
        {sent.length === 0 ? (
          <p className="text-sm text-slate-500">{t("noVisits")}</p>
        ) : (
          <ul className="space-y-3">
            {sent.map((v) => (
              <li key={v.id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <Link
                      href={`/annonce/${v.listing.id}`}
                      className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {v.listing.title}
                    </Link>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t("sellerLabel")} : {v.seller.profile?.displayName ?? v.seller.email}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {t("proposedAt", { date: dtFmt.format(v.proposedAt), time: timeFmt.format(v.proposedAt) })}
                    </p>
                    {v.message && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 italic">&ldquo;{v.message}&rdquo;</p>
                    )}
                    {v.sellerNote && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        {t("sellerNoteLabel")} : {v.sellerNote}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[v.status]}`}>
                      {t(`status${v.status}`)}
                    </span>
                    {(v.status === "EN_ATTENTE" || v.status === "CONFIRMEE") && (
                      <VisitRequestActions visitId={v.id} role="buyer" />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
