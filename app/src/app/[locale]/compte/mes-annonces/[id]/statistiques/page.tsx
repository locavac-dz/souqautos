import { getTranslations, getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { canManageListing } from "@/lib/listing-access";
import { Link } from "@/i18n/navigation";

export default async function ListingStatsPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("ListingStats");

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      sellerId: true,
      views: true,
      publishedAt: true,
      viewDays: { orderBy: { day: "desc" }, take: 30 },
      contactEvents: { select: { channel: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 },
    },
  });

  if (!listing) notFound();
  if (!(await canManageListing(user.id, listing.sellerId))) notFound();

  const callCount = listing.contactEvents.filter((e) => e.channel === "TELEPHONE").length;
  const whatsappCount = listing.contactEvents.filter((e) => e.channel === "WHATSAPP").length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/compte/mes-annonces"
        className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 underline"
      >
        <span aria-hidden="true" className="rtl:hidden">← </span>
        <span aria-hidden="true" className="ltr:hidden">→ </span>
        {t("backToListings")}
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("title")}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm">{listing.title}</p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatCard label={t("totalViews")} value={listing.views} />
        <StatCard label={t("calls")} value={callCount} />
        <StatCard label={t("whatsapp")} value={whatsappCount} />
      </div>

      {listing.viewDays.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t("viewsPerDay")}</h2>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 text-sm">
            {listing.viewDays.map((vd) => (
              <div key={vd.day.toISOString()} className="px-4 py-2 flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  {new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
                    dateStyle: "long",
                  }).format(vd.day)}
                </span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{vd.count} {t("views")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {listing.contactEvents.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t("recentContacts")}</h2>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 text-sm">
            {listing.contactEvents.slice(0, 20).map((ev, i) => (
              <div key={i} className="px-4 py-2 flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  {ev.channel === "TELEPHONE" ? t("channelPhone") : t("channelWhatsapp")}
                </span>
                <span className="text-slate-400 dark:text-slate-500">
                  {new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(ev.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-center">
      <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
