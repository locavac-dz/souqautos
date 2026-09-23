import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { WithdrawOfferButton } from "@/components/WithdrawOfferButton";
import { RespondOfferButtons } from "@/components/RespondOfferButtons";

export default async function OffresPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("Offer");

  const [received, sent] = await Promise.all([
    prisma.offer.findMany({
      where: { sellerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        listing: { select: { id: true, title: true } },
        buyer:   { select: { profile: { select: { displayName: true } } } },
      },
    }),
    prisma.offer.findMany({
      where: { buyerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        listing: { select: { id: true, title: true } },
      },
    }),
  ]);

  const statusLabel: Record<string, string> = {
    PENDING:   t("statusPending"),
    ACCEPTED:  t("statusAccepted"),
    DECLINED:  t("statusDeclined"),
    WITHDRAWN: t("statusWithdrawn"),
  };

  const statusColor: Record<string, string> = {
    PENDING:   "bg-amber-100 text-amber-800",
    ACCEPTED:  "bg-green-100 text-green-800",
    DECLINED:  "bg-red-100 text-red-800",
    WITHDRAWN: "bg-slate-100 text-slate-600",
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold text-slate-900 dark:text-white">{t("pageTitle")}</h1>

      {/* Offres reçues */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">{t("receivedTitle")}</h2>
        {received.length === 0 ? (
          <p className="text-sm text-slate-500">{t("emptyReceived")}</p>
        ) : (
          <ul className="space-y-3">
            {received.map((offer) => (
              <li key={offer.id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <Link
                      href={`/annonce/${offer.listing.id}`}
                      className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {offer.listing.title}
                    </Link>
                    <p className="text-base font-bold text-slate-900 dark:text-white">
                      {offer.amount.toLocaleString()} DA
                    </p>
                    <p className="text-xs text-slate-500">
                      {offer.buyer.profile?.displayName ?? t("unknownBuyer")}
                    </p>
                    {offer.message && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">&ldquo;{offer.message}&rdquo;</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[offer.status]}`}>
                      {statusLabel[offer.status]}
                    </span>
                    {offer.status === "PENDING" && (
                      <RespondOfferButtons offerId={offer.id} />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Offres envoyées */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">{t("sentTitle")}</h2>
        {sent.length === 0 ? (
          <p className="text-sm text-slate-500">{t("emptySent")}</p>
        ) : (
          <ul className="space-y-3">
            {sent.map((offer) => (
              <li key={offer.id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <Link
                      href={`/annonce/${offer.listing.id}`}
                      className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {offer.listing.title}
                    </Link>
                    <p className="text-base font-bold text-slate-900 dark:text-white">
                      {offer.amount.toLocaleString()} DA
                    </p>
                    {offer.message && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">&ldquo;{offer.message}&rdquo;</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[offer.status]}`}>
                      {statusLabel[offer.status]}
                    </span>
                    {offer.status === "PENDING" && (
                      <WithdrawOfferButton offerId={offer.id} />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
