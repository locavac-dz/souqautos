import { getTranslations } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { listComptes } from "@/lib/auth/admin-users";
import type { RoleName } from "@/lib/authz/permissions";
import { Nav } from "@/app/_components/Nav";
import { AdminUtilisateurs } from "@/app/admin/utilisateurs/_AdminUtilisateurs";

export const dynamic = "force-dynamic";

export default async function AdminUtilisateursPage() {
  const { session, s, ctx } = await requirePageTenant();
  const t = await getTranslations("admin");
  const tc = await getTranslations("commun");

  // Administration d'organisme : réservée au rôle ADMIN_OPGI.
  if ((session.role as RoleName) !== "ADMIN_OPGI") {
    return (
      <main>
        <Nav />
        <p role="alert">{tc("accesRefuse")}</p>
      </main>
    );
  }

  const comptes = await withTenant(s.app, ctx, (tx) => listComptes(tx, ctx.organisationId));

  return (
    <main>
      <Nav />
      <h1>{t("titre")}</h1>
      <p className="meta">{t("aide")}</p>
      <AdminUtilisateurs
        comptes={comptes.map((c) => ({
          id: c.id,
          email: c.email,
          role: c.role,
          perimetre: c.perimetre,
          actif: c.actif,
          deuxFacteurs: c.deuxFacteurs,
          verrouille: c.verrouille,
        }))}
        moiId={session.utilisateurId}
      />
    </main>
  );
}
