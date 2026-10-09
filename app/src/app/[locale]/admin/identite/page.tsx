import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isStaff } from "@/lib/auth-server/roles";
import { IdentityReviewActions } from "@/components/admin/IdentityReviewActions";

export default async function AdminIdentityRequestsPage() {
  const locale = await getLocale();
  // Lot 276 — réservé à l’équipe de modération : un rédacteur (EDITEUR) entre dans /admin mais pas ici.
  const viewer = await getCurrentUser();
  if (!viewer || !isStaff(viewer.role)) {
    redirect({ href: "/admin/mag", locale });
    return null;
  }
  const t = await getTranslations("Admin");

  const requests = await prisma.identityVerificationRequest.findMany({
    where: { status: "EN_ATTENTE" },
    orderBy: { createdAt: "asc" },
    include: { user: { include: { profile: true } } },
  });

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
        {t("identityRequests")} ({requests.length})
      </h1>
      {requests.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t("noIdentityRequests")}</p>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="flex gap-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex-1">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {req.user.profile?.displayName ?? req.user.email}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {req.user.email} ·{" "}
                  {t("submittedOn", {
                    date: new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
                      dateStyle: "medium",
                    }).format(req.createdAt),
                  })}
                </p>
                <a
                  href={`/api/admin/identity-requests/${req.id}/document`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-700 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-slate-100 mt-1 inline-block"
                >
                  {t("viewIdentityDocument")}
                </a>
              </div>
              <div className="w-56 shrink-0">
                <IdentityReviewActions requestId={req.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
