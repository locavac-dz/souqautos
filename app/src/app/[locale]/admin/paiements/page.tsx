import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { computePaymentOrderStats } from "@/lib/payment-orders";
import { PaymentOrderReviewActions } from "@/components/admin/PaymentOrderReviewActions";

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
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">{t("title")}</h1>
      <p className="text-sm text-slate-500 mb-6">{t("subtitle")}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-2">
        <StatCard label={t("statRevenueTotal")} value={`${numberFormatter.format(stats.totalRevenueDzd)} DA`} />
        <StatCard
          label={t("statConfirmationRate")}
          value={stats.confirmationRate === null ? "—" : percentFormatter.format(stats.confirmationRate)}
        />
        <StatCard label={t("statConfirmedCount")} value={stats.confirmedCount} />
        <StatCard label={t("statRejectedCount")} value={stats.rejectedCount} />
      </div>
      <p className="text-xs text-slate-500 mb-10">
        {t("statRevenueByFormula", {
          premium: numberFormatter.format(stats.premiumRevenueDzd),
          premiumPlus: numberFormatter.format(stats.premiumPlusRevenueDzd),
        })}
      </p>

      <h2 className="text-lg font-medium text-slate-900 mb-4">
        {t("pending")} ({orders.length})
      </h2>

      {orders.length === 0 ? (
        <p className="text-slate-500 text-sm">{t("empty")}</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="flex flex-col gap-4 rounded-lg border border-slate-200 p-3 sm:flex-row">
              <div className="flex-1">
                <p className="font-medium text-slate-900">
                  {order.user.profile?.displayName ?? order.user.email}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {order.user.email} · {dateFormatter.format(order.createdAt)}
                </p>
                <Link
                  href={`/annonce/${order.listingId}`}
                  target="_blank"
                  className="text-sm text-slate-700 underline hover:text-slate-900 mt-1 inline-block"
                >
                  {order.listing.title}
                </Link>
                <p className="text-sm text-slate-700 mt-1">
                  {t("formulaLabel")} : <strong>{order.formula}</strong> — {numberFormatter.format(order.amountDzd)} DA
                </p>
                <p className="text-sm text-slate-700 mt-1">
                  {t("referenceLabel")} :{" "}
                  <span className="font-mono" dir="ltr">
                    {order.reference}
                  </span>
                </p>
              </div>
              <div className="sm:w-56 sm:shrink-0">
                <PaymentOrderReviewActions orderId={order.id} />
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-medium text-slate-900 mb-4 mt-10">
        {t("subscriptionPending")} ({subscriptionOrders.length})
      </h2>

      {subscriptionOrders.length === 0 ? (
        <p className="text-slate-500 text-sm">{t("subscriptionEmpty")}</p>
      ) : (
        <div className="space-y-3">
          {subscriptionOrders.map((order) => (
            <div key={order.id} className="flex flex-col gap-4 rounded-lg border border-slate-200 p-3 sm:flex-row">
              <div className="flex-1">
                <p className="font-medium text-slate-900">
                  {order.user.profile?.displayName ?? order.user.email}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {order.user.email} · {dateFormatter.format(order.createdAt)}
                </p>
                <Link
                  href={`/pro/${order.professionalAccount.id}`}
                  target="_blank"
                  className="text-sm text-slate-700 underline hover:text-slate-900 mt-1 inline-block"
                >
                  {order.professionalAccount.nomCommercial}
                </Link>
                <p className="text-sm text-slate-700 mt-1">
                  {t("tierLabel")} : <strong>{order.tier}</strong> — {numberFormatter.format(order.amountDzd)} DA
                </p>
                <p className="text-sm text-slate-700 mt-1">
                  {t("referenceLabel")} :{" "}
                  <span className="font-mono" dir="ltr">
                    {order.reference}
                  </span>
                </p>
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
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}
