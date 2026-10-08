import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { computePaymentOrderStats } from "@/lib/payment-orders";
import { PaymentOrderReviewActions } from "@/components/admin/PaymentOrderReviewActions";
import { AdminChargilyRefresh } from "@/components/admin/AdminChargilyRefresh";
import type { PaymentEvent } from "@prisma/client";

// Réservé à ADMIN — un virement bancaire révèle une référence de transaction
// et un montant réel, plus sensible que la modération courante (ouverte à
// MODERATEUR partout ailleurs) : même seuil que la gestion du référentiel.
export default async function AdminPaymentOrdersPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }

  const t = await getTranslations("AdminPayments");

  const [orders, allOrdersForStats, subscriptionOrders] = await Promise.all([
    prisma.paymentOrder.findMany({
      where: { status: "EN_ATTENTE" },
      orderBy: { createdAt: "asc" },
      include: { user: { include: { profile: true } }, listing: { select: { id: true, title: true } } },
    }),
    prisma.paymentOrder.findMany({ select: { status: true, formula: true, amountDzd: true } }),
    prisma.proSubscriptionOrder.findMany({
      where: { status: "EN_ATTENTE" },
      orderBy: { createdAt: "asc" },
      include: { user: { include: { profile: true } }, professionalAccount: { select: { id: true, nomCommercial: true } } },
    }),
  ]);
  const stats = computePaymentOrderStats(allOrdersForStats);

  // Lot 266 — historique des décisions (webhook, relectures, balayage, admin) des commandes en attente : trois
  // dernières par commande, pour qu'un humain voie ce que les automates ont déjà tenté.
  const pendingIds = [...orders.map((o) => o.id), ...subscriptionOrders.map((o) => o.id)];
  const events = pendingIds.length
    ? await prisma.paymentEvent.findMany({ where: { orderId: { in: pendingIds } }, orderBy: { createdAt: "desc" }, take: 200 })
    : [];
  const eventsByOrder = new Map<string, PaymentEvent[]>();
  for (const event of events) {
    const list = eventsByOrder.get(event.orderId) ?? [];
    if (list.length < 3) list.push(event);
    eventsByOrder.set(event.orderId, list);
  }
  const EVENT_SOURCE_KEY = { WEBHOOK: "eventWEBHOOK", REFRESH_USER: "eventREFRESH_USER", REFRESH_ADMIN: "eventREFRESH_ADMIN", SWEEP: "eventSWEEP", ADMIN: "eventADMIN" } as const;
  const renderAutomation = (order: { id: string; provider: string; reviewNote: string | null }, kind: "listing_formula" | "pro_subscription") => {
    const history = eventsByOrder.get(order.id) ?? [];
    return (
      <>
        {order.reviewNote && (
          <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {t("noteLabel")} : <span className="font-mono" dir="ltr">{order.reviewNote}</span>
          </p>
        )}
        {history.length > 0 && (
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            <p className="font-medium">{t("eventsTitle")}</p>
            <ul className="mt-0.5 space-y-0.5">
              {history.map((event) => (
                <li key={event.id}>
                  {dateFormatter.format(event.createdAt)} · {t(EVENT_SOURCE_KEY[event.source])} → <span className="font-mono" dir="ltr">{event.outcome}</span>
                  {event.providerStatus ? <span className="font-mono" dir="ltr"> ({event.providerStatus})</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
        {order.provider === "CHARGILY" && <AdminChargilyRefresh kind={kind} orderId={order.id} />}
      </>
    );
  };

  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const numberFormatter = new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-DZ");
  const percentFormatter = new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
    style: "percent",
    maximumFractionDigits: 0,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{t("title")}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t("subtitle")}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-2">
        <StatCard label={t("statRevenueTotal")} value={`${numberFormatter.format(stats.totalRevenueDzd)} DA`} />
        <StatCard
          label={t("statConfirmationRate")}
          value={stats.confirmationRate === null ? "—" : percentFormatter.format(stats.confirmationRate)}
        />
        <StatCard label={t("statConfirmedCount")} value={stats.confirmedCount} />
        <StatCard label={t("statRejectedCount")} value={stats.rejectedCount} />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-10">
        {t("statRevenueByFormula", {
          premium: numberFormatter.format(stats.premiumRevenueDzd),
          premiumPlus: numberFormatter.format(stats.premiumPlusRevenueDzd),
        })}
        {" · "}
        {t("statCanceledCount", { count: stats.canceledCount })}
      </p>

      <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
        {t("pending")} ({orders.length})
      </h2>

      {orders.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t("empty")}</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="flex flex-col gap-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3 sm:flex-row">
              <div className="flex-1">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {order.user.profile?.displayName ?? order.user.email}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {order.user.email} · {dateFormatter.format(order.createdAt)}
                </p>
                <Link
                  href={`/annonce/${order.listingId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-700 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-slate-100 mt-1 inline-block"
                >
                  {order.listing.title}
                </Link>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  {t("formulaLabel")} : <strong>{order.formula}</strong> — {numberFormatter.format(order.amountDzd)} DA
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  {t("providerLabel")} : {order.provider === "CHARGILY" ? t("providerChargily") : t("providerVirement")}
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  {order.provider === "CHARGILY" ? t("checkoutIdLabel") : t("referenceLabel")} :{" "}
                  <span className="font-mono" dir="ltr">
                    {order.provider === "CHARGILY" ? order.providerCheckoutId ?? order.reference : order.reference}
                  </span>
                </p>
                {renderAutomation(order, "listing_formula")}
              </div>
              <div className="sm:w-56 sm:shrink-0">
                <PaymentOrderReviewActions orderId={order.id} />
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4 mt-10">
        {t("subscriptionPending")} ({subscriptionOrders.length})
      </h2>

      {subscriptionOrders.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t("subscriptionEmpty")}</p>
      ) : (
        <div className="space-y-3">
          {subscriptionOrders.map((order) => (
            <div key={order.id} className="flex flex-col gap-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3 sm:flex-row">
              <div className="flex-1">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {order.user.profile?.displayName ?? order.user.email}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {order.user.email} · {dateFormatter.format(order.createdAt)}
                </p>
                <Link
                  href={`/pro/${order.professionalAccount.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-700 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-slate-100 mt-1 inline-block"
                >
                  {order.professionalAccount.nomCommercial}
                </Link>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  {t("tierLabel")} : <strong>{order.tier}</strong> — {numberFormatter.format(order.amountDzd)} DA
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  {t("providerLabel")} : {order.provider === "CHARGILY" ? t("providerChargily") : t("providerVirement")}
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  {order.provider === "CHARGILY" ? t("checkoutIdLabel") : t("referenceLabel")} :{" "}
                  <span className="font-mono" dir="ltr">
                    {order.provider === "CHARGILY" ? order.providerCheckoutId ?? order.reference : order.reference}
                  </span>
                </p>
                {renderAutomation(order, "pro_subscription")}
              </div>
              <div className="sm:w-56 sm:shrink-0">
                <PaymentOrderReviewActions
                  orderId={order.id}
                  reviewUrl={`/api/admin/pro-subscription-orders/${order.id}/review`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1">{value}</p>
    </div>
  );
}
