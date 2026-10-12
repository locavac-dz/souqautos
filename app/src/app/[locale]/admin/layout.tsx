import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isStaff, isAdmin, isModerator, isEditor, hasBackOfficeAccess } from "@/lib/auth-server/roles";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }
  // Lot 276 — l'équipe de modération ET les rédacteurs (EDITEUR) entrent ; chacun ne voit que ses sections.
  if (!hasBackOfficeAccess(user.role)) {
    redirect({ href: "/", locale });
    return null;
  }

  const t = await getTranslations("Admin");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav aria-label={t("sectionsNav")} className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-8 text-sm border-b border-slate-200 dark:border-slate-700 pb-4">
        <Link href="/admin" className="font-medium text-slate-900 dark:text-slate-100">
          {t("dashboardTitle")}
        </Link>
        {isStaff(user.role) && (
          <Link href="/admin/annonces" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navListings")}
          </Link>
        )}
        {isModerator(user.role) && (
          <Link href="/admin/utilisateurs" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navUsers")}
          </Link>
        )}
        {isStaff(user.role) && (
          <Link href="/admin/signalements" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navReports")}
          </Link>
        )}
        {isStaff(user.role) && (
          <Link href="/admin/contact" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navContact")}
          </Link>
        )}
        {isStaff(user.role) && (
          <Link href="/admin/avis" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navReviews")}
          </Link>
        )}
        {isStaff(user.role) && (
          <Link href="/admin/avis-proprietaires" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navOwnerReviews")}
          </Link>
        )}
        {isModerator(user.role) && (
          <Link href="/admin/pro" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navPro")}
          </Link>
        )}
        {isModerator(user.role) && (
          <Link href="/admin/prospection" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navProspection")}
          </Link>
        )}
        {isStaff(user.role) && (
          <Link href="/admin/identite" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navIdentity")}
          </Link>
        )}
        {isStaff(user.role) && (
          <Link href="/admin/referentiels" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navCatalogue")}
          </Link>
        )}
        {isModerator(user.role) && (
          <Link href="/admin/statistiques" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navStatistics")}
          </Link>
        )}
        {isModerator(user.role) && (
          <Link href="/admin/audience" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navAudience")}
          </Link>
        )}
        {isModerator(user.role) && (
          <Link href="/admin/moderation" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navModeration")}
          </Link>
        )}
        {isAdmin(user.role) && (
          <Link href="/admin/rapports" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navWeeklyReport")}
          </Link>
        )}
        {isModerator(user.role) && (
          <Link href="/admin/parametres" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navSettings")}
          </Link>
        )}
        {isModerator(user.role) && (
          <Link href="/admin/journal" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navAuditLog")}
          </Link>
        )}
        {isAdmin(user.role) && (
          <Link href="/admin/paiements" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navPayments")}
          </Link>
        )}
        {isEditor(user.role) && (
          <Link href="/admin/mag" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navBlog")}
          </Link>
        )}
        {isEditor(user.role) && (
          <Link href="/admin/essais" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navRoadTests")}
          </Link>
        )}
        {isEditor(user.role) && (
          <Link href="/admin/guides" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navGuides")}
          </Link>
        )}
        {isAdmin(user.role) && (
          <Link href="/admin/equipement" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navEquipement")}
          </Link>
        )}
        {isEditor(user.role) && (
          <Link href="/admin/editorial" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navEditorial")}
          </Link>
        )}
        {isEditor(user.role) && (
          <Link href="/admin/revue-de-presse" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navPressReviews")}
          </Link>
        )}
        {isAdmin(user.role) && (
          <Link href="/admin/erreurs" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
            {t("navErrors")}
          </Link>
        )}
      </nav>
      {children}
    </div>
  );
}
