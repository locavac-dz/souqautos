import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { ModerationActions } from "@/components/admin/ModerationActions";

export default async function AdminListingsPage() {
  const locale = await getLocale();
  const t = await getTranslations("Admin");

  const [pending, published] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "EN_ATTENTE" },
      orderBy: { createdAt: "asc" },
      include: { photos: { orderBy: { position: "asc" }, take: 1 }, seller: { include: { profile: true } } },
    }),
    prisma.listing.findMany({
      where: { status: "PUBLIEE" },
      orderBy: { publishedAt: "desc" },
      take: 20,
      include: { photos: { orderBy: { position: "asc" }, take: 1 }, seller: { include: { profile: true } } },
    }),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-medium text-slate-900 mb-4">
          {t("pendingListings")} ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-slate-500 text-sm">{t("noPending")}</p>
        ) : (
          <div className="space-y-3">
            {pending.map((listing) => (
              <div key={listing.id} className="flex gap-4 rounded-lg border border-slate-200 p-3">
                <Thumbnail path={listing.photos[0]?.path} title={listing.title} />
                <div className="flex-1">
                  <Link href={`/annonce/${listing.id}`} className="font-medium text-slate-900 hover:underline">
                    {listing.title}
                  </Link>
                  <p className="text-sm text-slate-500">{listing.price.toLocaleString()} DA</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {t("sellerLabel")}: {listing.seller.profile?.displayName ?? listing.seller.email} ·{" "}
                    {t("submittedOn", {
                      date: new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
                        dateStyle: "medium",
                      }).format(listing.createdAt),
                    })}
                  </p>
                </div>
                <div className="w-56 shrink-0">
                  <ModerationActions listingId={listing.id} status="EN_ATTENTE" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium text-slate-900 mb-4">{t("publishedListingsSection")}</h2>
        <div className="space-y-3">
          {published.map((listing) => (
            <div key={listing.id} className="flex gap-4 rounded-lg border border-slate-200 p-3">
              <Thumbnail path={listing.photos[0]?.path} title={listing.title} />
              <div className="flex-1">
                <Link href={`/annonce/${listing.id}`} className="font-medium text-slate-900 hover:underline">
                  {listing.title}
                </Link>
                <p className="text-sm text-slate-500">{listing.price.toLocaleString()} DA</p>
                <p className="text-xs text-slate-400 mt-1">
                  {t("sellerLabel")}: {listing.seller.profile?.displayName ?? listing.seller.email}
                </p>
              </div>
              <div className="w-56 shrink-0">
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
  if (!path) return <div className="h-20 w-28 rounded bg-slate-100 shrink-0" />;
  return (
    <div className="relative h-20 w-28 shrink-0">
      <Image src={path} alt={title} fill sizes="112px" className="rounded object-cover border border-slate-100" />
    </div>
  );
}
