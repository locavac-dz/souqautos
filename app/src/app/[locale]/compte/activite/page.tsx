import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { resolveAbsolutePhotoUrl } from "@/lib/site";
import { FollowProButton } from "@/components/FollowProButton";

// Lot 162 — vue d'ensemble de l'activité d'achat : favoris, alertes, messages, concessionnaires suivis.

export default async function BuyerActivityPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("BuyerActivity");
  const numberLocale = locale === "ar" ? "ar-DZ" : "fr-DZ";
  const fmtDate = (d: Date) =>
    d.toLocaleDateString(numberLocale, { day: "numeric", month: "short", year: "numeric" });

  const [
    favoriteCount,
    recentFavorites,
    alertCount,
    recentMessages,
    followedPros,
  ] = await Promise.all([
    prisma.favorite.count({ where: { userId: user.id, listing: { status: "PUBLIEE" } } }),
    prisma.favorite.findMany({
      where: { userId: user.id, listing: { status: "PUBLIEE" } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        listing: {
          include: {
            brand: { select: { name: true } },
            model: { select: { name: true } },
            photos: { orderBy: { position: "asc" }, take: 1 },
            wilaya: { select: { nomFr: true, nomAr: true } },
          },
        },
      },
    }),
    prisma.searchAlert.count({ where: { userId: user.id } }),
    prisma.conversation.findMany({
      where: { buyerId: user.id, hiddenByBuyerAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        listing: { select: { id: true, title: true, photos: { orderBy: { position: "asc" }, take: 1 } } },
        seller: { include: { profile: { select: { displayName: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.proFollow.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        proAccount: {
          select: {
            id: true,
            nomCommercial: true,
            logoUrl: true,
            badgeVerifie: true,
            categoryPro: true,
          },
        },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-10">
      <h1 className="text-2xl font-semibold text-slate-900">{t("title")}</h1>

      {/* — Favoris — */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900">{t("favoritesTitle")}</h2>
          <span className="text-sm text-slate-500">{t("favoritesCount", { count: favoriteCount })}</span>
        </div>

        {recentFavorites.length === 0 ? (
          <p className="text-sm text-slate-500 rounded-lg border border-slate-100 bg-slate-50 p-4">
            {t("favoritesCount", { count: 0 })}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {recentFavorites.map(({ listing }) => {
              const photo = listing.photos[0]?.path;
              const label = listing.brand?.name ?? listing.brandFreeText ?? "";
              const wilayaName = locale === "ar" ? listing.wilaya.nomAr : listing.wilaya.nomFr;
              return (
                <Link
                  key={listing.id}
                  href={`/annonce/${listing.id}`}
                  className="group rounded-lg border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors"
                >
                  <div className="relative aspect-video bg-slate-100">
                    {photo && (
                      <Image
                        src={resolveAbsolutePhotoUrl(photo)}
                        alt={listing.title}
                        fill
                        sizes="(min-width: 640px) 200px, 160px"
                        className="object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-slate-900 truncate">{listing.title}</p>
                    <p className="text-xs text-slate-500">{label} · {wilayaName}</p>
                    <p className="text-xs font-semibold text-slate-800 mt-0.5">
                      {listing.price.toLocaleString(numberLocale)} DA
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {favoriteCount > 0 && (
          <div className="mt-3 text-right">
            <Link href="/compte/favoris" className="text-sm text-slate-700 hover:underline">
              {t("viewAllFavorites")}
            </Link>
          </div>
        )}
      </section>

      {/* — Alertes — */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900">{t("alertsTitle")}</h2>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
          <p className="text-sm text-slate-700">{t("alertsCount", { count: alertCount })}</p>
          <Link href="/compte/alertes" className="text-sm text-slate-700 hover:underline">
            {t("viewAlerts")}
          </Link>
        </div>
      </section>

      {/* — Messages récents — */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900">{t("messagesTitle")}</h2>
        </div>
        {recentMessages.length === 0 ? (
          <p className="text-sm text-slate-500 rounded-lg border border-slate-100 bg-slate-50 p-4">
            {t("messagesEmpty")}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {recentMessages.map((conv) => {
              const lastMsg = conv.messages[0];
              const sellerName = conv.seller.profile?.displayName ?? conv.seller.email;
              return (
                <li key={conv.id}>
                  <Link
                    href={`/compte/messages/${conv.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="relative h-10 w-10 shrink-0 rounded bg-slate-100 overflow-hidden">
                      {conv.listing.photos[0]?.path && (
                        <Image
                          src={resolveAbsolutePhotoUrl(conv.listing.photos[0].path)}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{conv.listing.title}</p>
                      <p className="text-xs text-slate-500 truncate">{sellerName}</p>
                      {lastMsg && (
                        <p className="text-xs text-slate-400 truncate">{lastMsg.content}</p>
                      )}
                    </div>
                    {lastMsg && (
                      <time className="ml-auto shrink-0 text-xs text-slate-400">
                        {fmtDate(lastMsg.createdAt)}
                      </time>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {recentMessages.length > 0 && (
          <div className="mt-3 text-right">
            <Link href="/compte/messages" className="text-sm text-slate-700 hover:underline">
              {t("viewAllMessages")}
            </Link>
          </div>
        )}
      </section>

      {/* — Concessionnaires suivis — */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900">{t("followedProsTitle")}</h2>
        </div>
        {followedPros.length === 0 ? (
          <p className="text-sm text-slate-500 rounded-lg border border-slate-100 bg-slate-50 p-4">
            {t("followedProsEmpty")}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {followedPros.map(({ proAccount }) => (
              <li key={proAccount.id} className="flex items-center gap-3 px-4 py-3">
                <Link href={`/pro/${proAccount.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="relative h-10 w-10 shrink-0 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                    {proAccount.logoUrl && (
                      <Image
                        src={proAccount.logoUrl}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{proAccount.nomCommercial}</p>
                    {proAccount.badgeVerifie && (
                      <span className="text-xs text-emerald-600">✓ Vérifié</span>
                    )}
                  </div>
                </Link>
                <div className="shrink-0">
                  <FollowProButton
                    proAccountId={proAccount.id}
                    initialFollowing={true}
                    isLoggedIn={true}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
