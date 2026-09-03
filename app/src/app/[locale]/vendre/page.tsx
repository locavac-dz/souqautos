import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";

export default async function VendrePage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  redirect({ href: user ? "/publier/etape-1" : "/connexion", locale });
  return null;
}
