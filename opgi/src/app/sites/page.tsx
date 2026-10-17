import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { listSites } from "@/lib/modules/a/service";
import { can, type RoleName } from "@/lib/authz/permissions";
import { Nav } from "@/app/_components/Nav";
import { BoutonArchiver } from "@/app/_components/BoutonArchiver";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const { session, s, ctx } = await requirePageTenant();
  const t = await getTranslations("sites");
  const tc = await getTranslations("commun");
  const role = session.role as RoleName;

  if (!can(role, "A", "lire")) {
    return (
      <main>
        <Nav />
        <p role="alert">{tc("accesRefuse")}</p>
      </main>
    );
  }

  const sites = await withTenant(s.app, ctx, (tx) => listSites(tx, ctx.organisationId));
  const peutModifier = can(role, "A", "modifier");

  return (
    <main>
      <Nav />
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <h1>{t("titre")}</h1>
        {can(role, "A", "creer") && <Link href="/sites/nouveau">{tc("nouveau")}</Link>}
      </header>

      <section className="card" aria-label={t("titre")}>
        {sites.length === 0 ? (
          <p>{t("aucun")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("code")}</th>
                <th scope="col">{t("nom")}</th>
                <th scope="col">{t("adresse")}</th>
                {peutModifier && <th scope="col">{tc("actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {sites.map((x) => (
                <tr key={x.id}>
                  <td>{x.code}</td>
                  <td>{x.nom}</td>
                  <td>{x.adresse ?? "—"}</td>
                  {peutModifier && (
                    <td>
                      <BoutonArchiver url={`/api/sites/${x.id}`} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
