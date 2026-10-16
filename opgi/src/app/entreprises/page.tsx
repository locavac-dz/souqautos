import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { listEntreprises } from "@/lib/modules/b/service";
import { can, type RoleName } from "@/lib/authz/permissions";
import { Nav } from "@/app/_components/Nav";

export const dynamic = "force-dynamic";

export default async function EntreprisesPage() {
  const { session, s, ctx } = await requirePageTenant();
  const t = await getTranslations("entreprises");
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

  const entreprises = await withTenant(s.app, ctx, (tx) => listEntreprises(tx, ctx.organisationId));

  return (
    <main>
      <Nav />
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <h1>{t("titre")}</h1>
        {can(role, "B", "creer") && <Link href="/entreprises/nouveau">{tc("nouveau")}</Link>}
      </header>
      <section className="card" aria-label={t("titre")}>
        {entreprises.length === 0 ? (
          <p>{t("aucune")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("raisonSociale")}</th>
                <th scope="col">{t("nif")}</th>
                <th scope="col">{t("rc")}</th>
                <th scope="col">{t("contact")}</th>
              </tr>
            </thead>
            <tbody>
              {entreprises.map((e) => (
                <tr key={e.id}>
                  <td>{e.raisonSociale}</td>
                  <td>{e.nif ?? "—"}</td>
                  <td>{e.rc ?? "—"}</td>
                  <td>{e.contact ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
