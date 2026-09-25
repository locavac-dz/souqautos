import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { ModerationActions } from "@/components/admin/ModerationActions";
import { getFraudSignalsForListings } from "@/lib/fraud-signals";

export default async function AdminListingsPage() {
  const locale = await getLocale();
  const t = await getTranslations("Admin");

  const [pending, published] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "EN_ATTENTE" },
      orderBy: { createdAt: "asc" },
      include: {
        photos: { orderBy: { position: "asc" }, select: { path: true, sha256: true } },
        seller: { include: { profile: true } },
      },
    }),
    prisma.listing.findMany({
      where: { status: "PUBLIEE" },
      orderBy: { publishedAt: "desc" },
      take: 20,
      include: { photos: { orderBy: { position: "asc" }, take: 1 }, seller: { include: { profile: true } } },
    }),
  ]);

  // Lot 77 — signaux anti-fraude (§16) : uniquement sur la file d'attente, où
  // ils aident concrètement une décision qui n'a pas encore été prise. Une
  // annonce déjà publiée a déjà été validée par un modérateur, jamais
  // ré-examinée automatiquement ici.
  const fraudSignals = await getFraudSignalsForListings(
    pending.map((l) => ({
      id: l.id,
      sellerId: l.sellerId,
      price: l.price,
      brandId: l.brandId,
      modelId: l.modelId,
      year: l.year,
      mileage: l.mileage,
      wilayaId: l.wilayaId,
      condition: l.condition,
      contentHash: l.contentHash,
      photos: l.photos,
    }))
  );

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
          {t("pendingListings")} ({pending.length})
        </h1>
        {pending.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t("noPending")}</p>
        ) : (
          <div className="space-y-3">
            {pending.map((listing) => {
              const signals = fraudSignals.get(listing.id);
              return (
                <div
                  key={listing.id}
                  className="flex flex-col gap-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3 sm:flex-row"
                >
                  <div className="flex gap-4">
                    <Thumbnail path={listing.photos[0]?.path} title={listing.title} />
                    <div className="flex-1">
                      <Link href={`/annonce/${listing.id}`} className="font-medium text-slate-900 dark:text-slate-100 hover:underline">
                        {listing.title}
                      </Link>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{listing.price.toLocaleString()} DA</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {t("sellerLabel")}: {listing.seller.profile?.displayName ?? listing.seller.email} ·{" "}
                        {t("submittedOn", {
                          date: new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
                            dateStyle: "medium",
                          }).format(listing.createdAt),
                        })}
                      </p>
                      {(signals?.duplicatePhoto ||
                        signals?.lowPrice ||
                        signals?.sellerRejectionHistory ||
                        signals?.duplicateContent ||
                        signals?.vehicleInconsistency) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {signals.duplicatePhoto && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                              {t("fraudSignalDuplicatePhoto")}
                            </span>
                          )}
                          {signals.duplicateContent && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                              {t("fraudSignalDuplicateContent")}
                            </span>
                          )}
                          {signals.lowPrice && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                              {t("fraudSignalLowPrice")}
                            </span>
                          )}
                          {signals.sellerRejectionHistory && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                              {t("fraudSignalRejectionHistory")}
                            </span>
                          )}
                          {signals.vehicleInconsistency && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                              {t("fraudSignalVehicleInconsistency")}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="sm:w-56 sm:shrink-0">
                    <ModerationActions listingId={listing.id} status="EN_ATTENTE" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">{t("publishedListingsSection")}</h2>
        <div className="space-y-3">
          {published.map((listing) => (
            <div key={listing.id} className="flex flex-col gap-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3 sm:flex-row">
              <div className="flex gap-4">
                <Thumbnail path={listing.photos[0]?.path} title={listing.title} />
                <div className="flex-1">
                  <Link href={`/annonce/${listing.id}`} className="font-medium text-slate-900 dark:text-slate-100 hover:underline">
                    {listing.title}
                  </Link>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{listing.price.toLocaleString()} DA</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t("sellerLabel")}: {listing.seller.profile?.displayName ?? listing.seller.email}
                  </p>
                </div>
              </div>
              <div className="sm:w-56 sm:shrink-0">
                <ModerationActions listingId={listing.id} status="PUBLIEE" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Thumbnail({ path, title }: { path?: string; title: string }) {
  if (!path) return <div className="h-20 w-28 rounded bg-slate-100 dark:bg-slate-700 shrink-0" />;
  return (
    <div className="relative h-20 w-28 shrink-0">
      <Image src={path} alt={title} fill sizes="112px" className="rounded object-cover border border-slate-100 dark:border-slate-700" />
    </div>
  );
}
