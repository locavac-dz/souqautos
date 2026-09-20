import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { ReportActions } from "@/components/admin/ReportActions";

const REASON_KEY: Record<string, string> = {
  PRIX_SUSPECT: "reasonPrixSuspect",
  FRAUDE_SUSPECTEE: "reasonFraudeSuspectee",
  VEHICULE_VOLE: "reasonVehiculeVole",
  DOUBLON: "reasonDoublon",
  CONTENU_INAPPROPRIE: "reasonContenuInapproprie",
  COMPORTEMENT_FRAUDULEUX: "reasonComportementFrauduleux",
  MESSAGES_ABUSIFS: "reasonMessagesAbusifs",
  USURPATION_IDENTITE: "reasonUsurpationIdentite",
  AUTRE: "reasonAutre",
};

export default async function AdminReportsPage() {
  const locale = await getLocale();
  const t = await getTranslations("Admin");
  const tReport = await getTranslations("Report");

  const reports = await prisma.report.findMany({
    where: { status: "OUVERT" },
    orderBy: { createdAt: "asc" },
    include: {
      listing: { include: { photos: { orderBy: { position: "asc" }, take: 1 } } },
      reportedUser: { include: { profile: true } },
      ownerReview: { include: { model: { include: { brand: true } } } },
      author: { include: { profile: true } },
    },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900 mb-4">
        {t("openReports")} ({reports.length})
      </h1>
      {reports.length === 0 ? (
        <p className="text-slate-500 text-sm">{t("noOpenReports")}</p>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="flex gap-4 rounded-lg border border-slate-200 p-3">
              {report.listing ? (
                <Thumbnail path={report.listing.photos[0]?.path} title={report.listing.title} />
              ) : (
                <div className="h-20 w-28 rounded bg-slate-100 shrink-0 flex items-center justify-center text-xs text-slate-500">
                  {report.ownerReview ? t("ownerReviewReportBadge") : t("userReportBadge")}
                </div>
              )}
              <div className="flex-1">
                {report.listing ? (
                  <Link
                    href={`/annonce/${report.listing.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {report.listing.title}
                  </Link>
                ) : report.ownerReview ? (
                  <>
                    <Link
                      href={`/voitures/${report.ownerReview.model.brand.slug}/${report.ownerReview.model.slug}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {report.ownerReview.model.brand.name} {report.ownerReview.model.name}
                    </Link>
                    <p className="mt-1 whitespace-pre-line rounded bg-slate-50 p-2 text-sm text-slate-600" dir="auto">
                      {report.ownerReview.comment}
                    </p>
                  </>
                ) : (
                  report.reportedUser && (
                    <Link
                      href={`/vendeur/${report.reportedUser.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {report.reportedUser.profile?.displayName ?? report.reportedUser.email}
                    </Link>
                  )
                )}
                <p className="text-sm text-slate-700 mt-1">{tReport(REASON_KEY[report.reason])}</p>
                {report.comment && <p className="text-sm text-slate-500 mt-0.5">{report.comment}</p>}
                <p className="text-xs text-slate-500 mt-1">
                  {t("reportedBy")}: {report.author.profile?.displayName ?? report.author.email} ·{" "}
                  {t("reportedOn", {
                    date: new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
                      dateStyle: "medium",
                    }).format(report.createdAt),
                  })}
                </p>
              </div>
              <div className="w-56 shrink-0">
                <ReportActions reportId={report.id} />
              </div>
            </div>
          ))}
        </div>
      )}
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
