import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { sweepExpiredListings } from "@/lib/listing-expiry-sweep";
import { sweepExpiringListingsForReminders } from "@/lib/listing-expiry-reminder-sweep";
import {
  checkListingRenewable,
  checkListingCanBeMarkedSold,
  checkListingPriceEditable,
  checkListingContentEditable,
} from "@/lib/listing-lifecycle";
import { canManageProListings } from "@/lib/pro-account";
import { parseProPermissions } from "@/lib/pro-permissions";
import { StatusBadge } from "@/components/StatusBadge";
import { ListingLifecycleActions } from "@/components/ListingLifecycleActions";
import { ListingPriceEditor } from "@/components/ListingPriceEditor";

export default async function MyListingsPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("MyListings");
  const tListing = await getTranslations("Listing");

  await sweepExpiredListings();
  await sweepExpiringListingsForReminders();

  // Lot 43 — comble l'écart signalé au Lot 41 : les annonces d'un compte
  // professionnel appartiennent toujours à sellerId = ProfessionalAccount.userId,
  // jamais au collaborateur qui les gère. Sans ce lot, un collaborateur ne
  // voyait ici que ses propres annonces personnelles (le plus souvent
  // aucune), jamais le stock du compte qu'il gère — y compris les brouillons
  // qu'il vient lui-même d'importer en masse (Lot 41).
  const collaborations = await prisma.proCollaborator.findMany({
    where: { userId: user.id },
    include: { professionalAccount: true },
  });

  const proAccountBySellerId = new Map(
    collaborations.map((c) => [
      c.professionalAccount.userId,
      {
        name: c.professionalAccount.nomCommercial,
        canManage: canManageProListings({
          isOwner: false,
          permissions: parseProPermissions(c.permissions),
        }),
      },
    ])
  );

  const sellerIds = [user.id, ...proAccountBySellerId.keys()];

  const listings = await prisma.listing.findMany({
    where: { sellerId: { in: sellerIds } },
    include: { photos: { orderBy: { position: "asc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">{t("title")}</h1>

      {listings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 mb-4">{t("empty")}</p>
          <Link
            href="/vendre"
            className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {t("createFirst")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const isOwnListing = listing.sellerId === user.id;
            const proAccount = isOwnListing ? null : proAccountBySellerId.get(listing.sellerId);
            const canManage = isOwnListing || Boolean(proAccount?.canManage);

            return (
              <div
                key={listing.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 hover:border-slate-300"
              >
                <Link href={`/annonce/${listing.id}`} className="flex gap-4">
                  {listing.photos[0] ? (
                    <div className="relative h-20 w-28 shrink-0">
                      <Image
                        src={listing.photos[0].path}
                        alt=""
                        fill
                        sizes="112px"
                        className="rounded object-cover border border-slate-100"
                      />
                    </div>
                  ) : (
                    <div className="h-20 w-28 rounded bg-slate-100 shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{listing.title}</p>
                    <p className="text-sm text-slate-500">{listing.price.toLocaleString()} DA</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <StatusBadge status={listing.status} />
                      <span>{t("views", { count: listing.views })}</span>
                    </div>
                    {proAccount && (
                      <p className="mt-1 text-xs text-slate-400">
                        {t("proAccountLabel", { name: proAccount.name })}
                      </p>
                    )}
                    {listing.moderationNote &&
                      (listing.status === "REFUSEE" || listing.status === "SUSPENDUE") && (
                        <p className="mt-1 text-xs text-red-600">
                          {tListing("moderationReasonLabel")}: {listing.moderationNote}
                        </p>
                      )}
                    {listing.expiresAt && (listing.status === "PUBLIEE" || listing.status === "EXPIREE") && (
                      <p className="mt-1 text-xs text-slate-400">
                        {tListing(listing.status === "EXPIREE" ? "expiredOnLabel" : "expiresOnLabel", {
                          date: new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
                            dateStyle: "long",
                          }).format(listing.expiresAt),
                        })}
                      </p>
                    )}
                  </div>
                </Link>
                {canManage && (
                  <div className="flex flex-wrap items-center gap-3">
                    <ListingLifecycleActions
                      listingId={listing.id}
                      canRenew={checkListingRenewable(listing.status).ok}
                      canMarkSold={checkListingCanBeMarkedSold(listing.status).ok}
                      renewLabel={tListing("renewAction")}
                      markSoldLabel={tListing("markSoldAction")}
                      errorLabel={tListing("lifecycleErrorGeneric")}
                    />
                    {checkListingPriceEditable(listing.status).ok && (
                      <ListingPriceEditor
                        listingId={listing.id}
                        currentPrice={listing.price}
                        newPriceLabel={tListing("newPriceLabel")}
                        editLabel={tListing("editPriceAction")}
                        saveLabel={tListing("savePriceAction")}
                        cancelLabel={tListing("cancelAction")}
                        errorLabel={tListing("lifecycleErrorGeneric")}
                      />
                    )}
                    {checkListingContentEditable(listing.status).ok && (
                      <Link
                        href={`/compte/mes-annonces/${listing.id}/modifier`}
                        className="text-xs text-slate-500 underline hover:text-slate-700"
                      >
                        {tListing("editListingAction")}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
