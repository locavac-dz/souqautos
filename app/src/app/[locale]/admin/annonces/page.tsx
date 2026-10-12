import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isStaff } from "@/lib/auth-server/roles";
import { ModerationActions } from "@/components/admin/ModerationActions";
import { AssignmentControls } from "@/components/admin/AssignmentControls";
import { TeamActivityTable } from "@/components/admin/TeamActivityTable";
import { isAdmin } from "@/lib/auth-server/roles";
import { getFraudSignalsForListings } from "@/lib/fraud-signals";
import type { PhotoAiTag } from "@/lib/photo-ai";

export default async function AdminListingsPage() {
  const locale = await getLocale();
  // Lot 276 — réservé à l’équipe de modération : un rédacteur (EDITEUR) entre dans /admin mais pas ici.
  const viewer = await getCurrentUser();
  if (!viewer || !isStaff(viewer.role)) {
    redirect({ href: "/admin/mag", locale });
    return null;
  }
  const t = await getTranslations("Admin");

  const [pending, published] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "EN_ATTENTE" },
      // Lot 246 — les annonces les plus risquées d'abord ; à score égal, FIFO.
      orderBy: [{ fraudScore: "desc" }, { createdAt: "asc" }],
      include: {
        photos: { orderBy: { position: "asc" }, select: { path: true, sha256: true, aiTags: true } },
        seller: { include: { profile: true } },
        assignedTo: { select: { id: true, email: true } },
      },
    }),
    prisma.listing.findMany({
      where: { status: "PUBLIEE" },
      orderBy: [{ fraudScore: "desc" }, { publishedAt: "desc" }],
      take: 20,
      include: { photos: { orderBy: { position: "asc" }, take: 1 }, seller: { include: { profile: true } } },
    }),
  ]);

  // Lot 77 — signaux anti-fraude (§16) : sur la file d'attente, ils aident la décision.
  // Lot 303 — les annonces publiées sont aussi re-vérifiées par le cron (fraudScore mis à jour).
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
      vin: l.vin,
      photos: l.photos,
    }))
  );

  return (
    <div className="space-y-10">
      {/* Lot 277 — activité de l'équipe */}
      <TeamActivityTable />
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
                      <p className="text-sm text-slate-500 dark:text-slate-400">{formatNumber(listing.price, locale)} DA</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {t("sellerLabel")}: {listing.seller.profile?.displayName ?? listing.seller.email} ·{" "}
                        {t("submittedOn", {
                          date: new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
                            dateStyle: "medium",
                          }).format(listing.createdAt),
                        })}
                      </p>
                      {/* Lot 277 — prise en charge */}
                      <AssignmentControls
                        kind="listings"
                        id={listing.id}
                        assignee={listing.assignedTo}
                        assignedAt={listing.assignedAt?.toISOString() ?? null}
                        currentUserId={viewer.id}
                        canRelease={isAdmin(viewer.role)}
                      />
                      {/* Lot 246 — score composite + note IA */}
                      {listing.fraudCheckedAt && listing.fraudScore > 0 && (
                        <span
                          className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            listing.fraudScore >= 60
                              ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                              : "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {t("fraudScore")}&nbsp;{listing.fraudScore}/100
                        </span>
                      )}
                      {listing.vin && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          VIN : <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{listing.vin}</span>
                        </p>
                      )}
                      {(signals?.duplicatePhoto ||
                        signals?.lowPrice ||
                        signals?.sellerRejectionHistory ||
                        signals?.duplicateContent ||
                        signals?.vehicleInconsistency ||
                        signals?.duplicateVin) && (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {signals.duplicatePhoto && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {t("fraudSignalDuplicatePhoto")}
                            </span>
                          )}
                          {signals.duplicateContent && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {t("fraudSignalDuplicateContent")}
                            </span>
                          )}
                          {signals.lowPrice && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {t("fraudSignalLowPrice")}
                            </span>
                          )}
                          {signals.sellerRejectionHistory && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {t("fraudSignalRejectionHistory")}
                            </span>
                          )}
                          {signals.vehicleInconsistency && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {t("fraudSignalVehicleInconsistency")}
                            </span>
                          )}
                          {signals.duplicateVin && (
                            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                              {t("fraudSignalDuplicateVin")}
                            </span>
                          )}
                        </div>
                      )}
                      {listing.aiSuspicion && (
                        <p className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">
                          {t("fraudAiPrefix")} {listing.aiSuspicion}
                        </p>
                      )}
                      {/* Lot 248 — fourchette IA quand les comparables DB sont insuffisants */}
                      {listing.priceAiLow && listing.priceAiHigh && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {t("priceAiRange")}{" "}
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {formatNumber(listing.priceAiLow, locale)} – {formatNumber(listing.priceAiHigh, locale)} DA
                          </span>
                        </p>
                      )}
                      {/* Lot 247 — tags IA des photos : watermark et photo catalogue */}
                      {(() => {
                        const photoTags = listing.photos
                          .map((p) => {
                            if (!p.aiTags) return null;
                            try { return JSON.parse(p.aiTags) as PhotoAiTag; } catch { return null; }
                          })
                          .filter((t): t is PhotoAiTag => t !== null);
                        const anyWatermark = photoTags.some((tag) => tag.hasWatermark);
                        const anyStock = photoTags.some((tag) => tag.isProfessionalStock);
                        if (!anyWatermark && !anyStock) return null;
                        return (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {anyWatermark && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                {t("photoAiWatermark")}
                              </span>
                            )}
                            {anyStock && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                {t("photoAiProfessionalStock")}
                              </span>
                            )}
                          </div>
                        );
                      })()}
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
                  <p className="text-sm text-slate-500 dark:text-slate-400">{formatNumber(listing.price, locale)} DA</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {listing.autoPublishedAt && (
                      <span className="inline-block rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                        {t("autoPublishedBadge")}
                      </span>
                    )}
                    {listing.fraudScore > 0 && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          listing.fraudScore >= 60
                            ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                            : "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {t("fraudScore")}&nbsp;{listing.fraudScore}/100
                      </span>
                    )}
                  </div>
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
