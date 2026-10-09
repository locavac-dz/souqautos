import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isEditor } from "@/lib/auth-server/roles";
import { AdminBlogList } from "@/components/admin/AdminBlogList";

// Réservé à ADMIN — le blog est un contenu public engageant l'image de la
// marque, pas une action de modération courante (cf. route.ts).
export default async function AdminBlogPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isEditor(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }

  return <AdminBlogList kind="ARTICLE" />;
}
