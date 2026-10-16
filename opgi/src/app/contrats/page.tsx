import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { can, type RoleName } from "@/lib/authz/permissions";
import { Nav } from "@/app/_components/Nav";
import { BoutonArchiver } from "@/app/_components/BoutonArchiver";

export const dynamic = "force-dynamic";

function loyer(centimes: number | null): string {
  if (centimes == null) return "—";
  return (centimes / 100).toLocaleString("fr-DZ", { minimumFractionDigits: 2 });
}

export default async function ContratsPage() {
  const { session, s, ctx } = await requirePageTenant();
  const t = await getTranslations("contrats");
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

  const contrats = await withTenant(s.app, ctx, (tx) =>
    tx.contrat.findMany({
      where: { organisationId: ctx.organisationId, archiveLe: null },
      orderBy: { reference: "asc" },
      select: {
        id: true,
        reference: true,
        statut: true,
        dateDebut: true,
        montantLoyerCentimes: true,
        bien: { select: { code: true } },
        occupant: { select: { nom: true } },
      },
    }),
  );
  const peutModifier = can(role, "A", "modifier");

  return (
    <main>
      <Nav />
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <h1>{t("titre")}</h1>
        <span style={{ display: "flex", gap: 12 }}>
          {can(role, "A", "exporter") && <a href="/api/export?type=contrats">{tc("exporterCsv")}</a>}
          {can(role, "A", "creer") && <Link href="/contrats/nouveau">{tc("nouveau")}</Link>}
        </span>
      </header>

      <section className="card" aria-label={t("titre")}>
        {contrats.length === 0 ? (
          <p>{tc("aucun")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("reference")}</th>
                <th scope="col">{t("bien")}</th>
                <th scope="col">{t("occupant")}</th>
                <th scope="col">{t("statut")}</th>
                <th scope="col">{t("dateDebut")}</th>
                <th scope="col">{t("loyer")}</th>
                {peutModifier && <th scope="col">{tc("actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {contrats.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/contrats/${c.id}`}>{c.reference}</Link>
                  </td>
                  <td>{c.bien.code}</td>
                  <td>{c.occupant.nom}</td>
                  <td>{c.statut}</td>
                  <td>{c.dateDebut.toISOString().slice(0, 10)}</td>
                  <td>{loyer(c.montantLoyerCentimes)}</td>
                  {peutModifier && (
                    <td>
                      <BoutonArchiver url={`/api/contrats/${c.id}`} />
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
