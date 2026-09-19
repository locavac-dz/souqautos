import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isStaff, isAdmin } from "@/lib/auth-server/roles";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }
  if (!isStaff(user.role)) {
    redirect({ href: "/", locale });
    return null;
  }

  const t = await getTranslations("Admin");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-8 text-sm border-b border-slate-200 pb-4">
        <Link href="/admin" className="font-medium text-slate-900">
          {t("dashboardTitle")}
        </Link>
        <Link href="/admin/annonces" className="text-slate-600 hover:text-slate-900">
          {t("navListings")}
        </Link>
        <Link href="/admin/utilisateurs" className="text-slate-600 hover:text-slate-900">
          {t("navUsers")}
        </Link>
        <Link href="/admin/signalements" className="text-slate-600 hover:text-slate-900">
          {t("navReports")}
        </Link>
        <Link href="/admin/avis" className="text-slate-600 hover:text-slate-900">
          {t("navReviews")}
        </Link>
        <Link href="/admin/avis-proprietaires" className="text-slate-600 hover:text-slate-900">
          {t("navOwnerReviews")}
        </Link>
        <Link href="/admin/pro" className="text-slate-600 hover:text-slate-900">
          {t("navPro")}
        </Link>
        <Link href="/admin/identite" className="text-slate-600 hover:text-slate-900">
          {t("navIdentity")}
        </Link>
        <Link href="/admin/referentiels" className="text-slate-600 hover:text-slate-900">
          {t("navCatalogue")}
        </Link>
        <Link href="/admin/statistiques" className="text-slate-600 hover:text-slate-900">
          {t("navStatistics")}
        </Link>
        <Link href="/admin/audience" className="text-slate-600 hover:text-slate-900">
          {t("navAudience")}
        </Link>
        <Link href="/admin/parametres" className="text-slate-600 hover:text-slate-900">
          {t("navSettings")}
        </Link>
        <Link href="/admin/journal" className="text-slate-600 hover:text-slate-900">
          {t("navAuditLog")}
        </Link>
        {isAdmin(user.role) && (
          <Link href="/admin/paiements" className="text-slate-600 hover:text-slate-900">
            {t("navPayments")}
          </Link>
        )}
        {isAdmin(user.role) && (
          <Link href="/admin/mag" className="text-slate-600 hover:text-slate-900">
            {t("navBlog")}
          </Link>
        )}
        {isAdmin(user.role) && (
          <Link href="/admin/essais" className="text-slate-600 hover:text-slate-900">
            {t("navRoadTests")}
          </Link>
        )}
        {isAdmin(user.role) && (
          <Link href="/admin/guides" className="text-slate-600 hover:text-slate-900">
            {t("navGuides")}
          </Link>
        )}
        {isAdmin(user.role) && (
          <Link href="/admin/revue-de-presse" className="text-slate-600 hover:text-slate-900">
            {t("navPressReviews")}
          </Link>
        )}
      </nav>
      {children}
    </div>
  );
}
