import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { listProjets } from "@/lib/modules/b/service";
import { can, type RoleName } from "@/lib/authz/permissions";
import { Nav } from "@/app/_components/Nav";

export const dynamic = "force-dynamic";

export default async function ProjetsPage() {
  const { session, s, ctx } = await requirePageTenant();
  const t = await getTranslations("projets");
  const tc = await getTranslations("commun");
  const role = session.role as RoleName;

  if (!can(role, "B", "lire")) {
    return (
      <main>
        <Nav />
        <p role="alert">Votre rôle ne permet pas d'accéder au module B.</p>
      </main>
    );
  }

  const projets = await withTenant(s.app, ctx, (tx) => listProjets(tx, ctx.organisationId));

  return (
    <main>
      <Nav />
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <h1>{t("titre")}</h1>
        {can(role, "B", "creer") && <Link href="/projets/nouveau">{tc("nouveau")}</Link>}
      </header>
      <section className="card" aria-label={t("titre")}>
        {projets.length === 0 ? (
          <p>{t("aucun")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("code")}</th>
                <th scope="col">{t("intitule")}</th>
                <th scope="col">{t("programme")}</th>
                <th scope="col">{t("statut")}</th>
                <th scope="col">{t("sourceFinancement")}</th>
              </tr>
            </thead>
            <tbody>
              {projets.map((p) => (
                <tr key={p.id}>
                  <td>{p.code}</td>
                  <td>{p.intitule}</td>
                  <td>{p.programme ?? "—"}</td>
                  <td>{p.statut}</td>
                  <td>{p.sourceFinancement ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
