import { getTranslations } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { can, type RoleName } from "@/lib/authz/permissions";
import { Nav } from "@/app/_components/Nav";
import { GenererAppels } from "@/app/appels/_GenererAppels";

export const dynamic = "force-dynamic";

export default async function AppelsPage() {
  const { session } = await requirePageTenant();
  const t = await getTranslations("appels");
  const tc = await getTranslations("commun");
  const role = session.role as RoleName;

  if (!can(role, "A", "creer")) {
    return (
      <main>
        <Nav />
        <p role="alert">{tc("accesRefuse")}</p>
      </main>
    );
  }

  return (
    <main>
      <Nav />
      <h1>{t("titre")}</h1>
      <GenererAppels />
    </main>
  );
}
