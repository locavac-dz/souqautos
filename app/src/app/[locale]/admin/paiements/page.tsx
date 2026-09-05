import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
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

  const orders = await prisma.paymentOrder.findMany({
    where: { status: "EN_ATTENTE" },
    orderBy: { createdAt: "asc" },
    include: { user: { include: { profile: true } }, listing: { select: { id: true, title: true } } },
  });

  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">{t("title")}</h1>
      <p className="text-sm text-slate-500 mb-6">{t("subtitle")}</p>

      <h2 className="text-lg font-medium text-slate-900 mb-4">
        {t("pending")} ({orders.length})
      </h2>

      {orders.length === 0 ? (
        <p className="text-slate-500 text-sm">{t("empty")}</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="flex gap-4 rounded-lg border border-slate-200 p-3">
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
                  {t("formulaLabel")} : <strong>{order.formula}</strong> — {order.amountDzd.toLocaleString()} DA
                </p>
                <p className="text-sm text-slate-700 mt-1">
                  {t("referenceLabel")} :{" "}
                  <span className="font-mono" dir="ltr">
                    {order.reference}
                  </span>
                </p>
              </div>
              <div className="w-56 shrink-0">
                <PaymentOrderReviewActions orderId={order.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
