import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isEditor } from "@/lib/auth-server/roles";
import { AdminBlogList } from "@/components/admin/AdminBlogList";

// Lot 126 — guides d'achat : même seuil que le magazine et les essais (ADMIN seulement).
export default async function AdminGuidesPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isEditor(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }

  return <AdminBlogList kind="GUIDE" />;
}
