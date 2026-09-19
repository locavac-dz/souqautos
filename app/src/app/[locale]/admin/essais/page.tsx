import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { AdminBlogList } from "@/components/admin/AdminBlogList";

// Lot 110 — essais auto : même seuil que le magazine (ADMIN seulement).
export default async function AdminRoadTestsPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }

  return <AdminBlogList kind="ESSAI" />;
}
