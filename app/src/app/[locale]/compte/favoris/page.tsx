import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";

export default async function FavoritesPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("Favorites");

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id, listing: { status: "PUBLIEE" } },
    include: {
      listing: {
        include: { photos: { orderBy: { position: "asc" }, take: 1 }, brand: true, model: true, wilaya: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">{t("title")}</h1>

      {favorites.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400 mb-4">{t("empty")}</p>
          <Link
            href="/recherche"
            className="inline-block rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {t("browseListings")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map(({ listing }) => {
            const brandLabel = listing.brand?.name ?? listing.brandFreeText ?? "";
            const modelLabel = listing.model?.name ?? listing.modelFreeText ?? "";
            const wilayaLabel = locale === "ar" ? listing.wilaya.nomAr : listing.wilaya.nomFr;
            return (
              <Link
                key={listing.id}
                href={`/annonce/${listing.id}`}
                className="flex gap-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-slate-300 dark:hover:border-slate-500"
              >
                {listing.photos[0] ? (
                  <div className="relative h-20 w-28 shrink-0">
                    <Image
                      src={listing.photos[0].path}
                      alt=""
                      fill
                      sizes="112px"
                      className="rounded object-cover border border-slate-100 dark:border-slate-700"
                    />
                  </div>
                ) : (
                  <div className="h-20 w-28 rounded bg-slate-100 dark:bg-slate-700 shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{listing.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    <span lang="fr">{brandLabel} {modelLabel}</span> · {wilayaLabel}
                  </p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">
                    {listing.price.toLocaleString()} DA
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
