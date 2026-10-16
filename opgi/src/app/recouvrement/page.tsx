import { getTranslations } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { listImpayes } from "@/lib/modules/a/finances";
import { can, type RoleName } from "@/lib/authz/permissions";
import { Nav } from "@/app/_components/Nav";

export const dynamic = "force-dynamic";

function dzd(centimes: number): string {
  return (centimes / 100).toLocaleString("fr-DZ", { minimumFractionDigits: 2 });
}

export default async function RecouvrementPage() {
  const { session, s, ctx } = await requirePageTenant();
  const t = await getTranslations("recouvrement");
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

  const impayes = await withTenant(s.app, ctx, (tx) => listImpayes(tx, ctx.organisationId));

  return (
    <main>
      <Nav />
      <h1>{t("titre")}</h1>
      <section className="card" aria-label={t("titre")}>
        {impayes.length === 0 ? (
          <p>{t("aucunImpaye")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("contrat")}</th>
                <th scope="col">{t("bien")}</th>
                <th scope="col">{t("occupant")}</th>
                <th scope="col">{t("periode")}</th>
                <th scope="col">{t("echeance")}</th>
                <th scope="col">{t("solde")}</th>
                <th scope="col" title={t("joursRetardAide")}>
                  {t("joursRetard")}
                </th>
              </tr>
            </thead>
            <tbody>
              {impayes.map((i) => (
                <tr key={i.id}>
                  <td>{i.contratReference}</td>
                  <td>{i.bienCode}</td>
                  <td>{i.occupantNom}</td>
                  <td>{i.periode}</td>
                  <td>{i.dateEcheance.toISOString().slice(0, 10)}</td>
                  <td>
                    <strong>{dzd(i.soldeCentimes)}</strong>
                  </td>
                  <td>{i.joursRetard}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="meta">{t("joursRetardAide")}</p>
      </section>
    </main>
  );
}
