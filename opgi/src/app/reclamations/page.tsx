import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { listReclamations } from "@/lib/modules/c/service";
import { can, type RoleName } from "@/lib/authz/permissions";
import { Nav } from "@/app/_components/Nav";

export const dynamic = "force-dynamic";

export default async function ReclamationsPage() {
  const { session, s, ctx } = await requirePageTenant();
  const t = await getTranslations("reclamations");
  const tc = await getTranslations("commun");
  const role = session.role as RoleName;

  if (!can(role, "C", "lire")) {
    return (
      <main>
        <Nav />
        <p role="alert">{tc("accesRefuse")}</p>
      </main>
    );
  }

  const reclamations = await withTenant(s.app, ctx, (tx) =>
    listReclamations(tx, ctx.organisationId, {
      utilisateurId: session.utilisateurId,
      role: session.role,
    }),
  );

  return (
    <main>
      <Nav />
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <h1>{t("titre")}</h1>
        {can(role, "C", "creer") && <Link href="/reclamations/nouveau">{tc("nouveau")}</Link>}
      </header>

      <section className="card" aria-label={t("titre")}>
        {reclamations.length === 0 ? (
          <p>{t("aucune")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("reference")}</th>
                <th scope="col">{t("categorie")}</th>
                <th scope="col">{t("urgence")}</th>
                <th scope="col">{t("statut")}</th>
                <th scope="col">{t("description")}</th>
                <th scope="col">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {reclamations.map((r) => (
                <tr key={r.id}>
                  <td>{r.reference}</td>
                  <td>{r.categorie}</td>
                  <td>{r.urgence}</td>
                  <td>{r.statut}</td>
                  <td>{r.description.slice(0, 60)}</td>
                  <td>
                    <Link href={`/reclamations/${r.id}`}>{t("voir")}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
