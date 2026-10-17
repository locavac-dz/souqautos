import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getMessages } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { getContrat } from "@/lib/modules/a/service";
import { listAppels, listPaiements, listActionsRecouvrement } from "@/lib/modules/a/finances";
import { can, type RoleName } from "@/lib/authz/permissions";
import { libelleEnum, type DictEnums } from "@/i18n/enums";
import { Nav } from "@/app/_components/Nav";
import { ContratActions } from "@/app/contrats/[id]/_ContratActions";

export const dynamic = "force-dynamic";

function dzd(centimes: number): string {
  return (centimes / 100).toLocaleString("fr-DZ", { minimumFractionDigits: 2 });
}
function jour(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function ContratDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, s, ctx } = await requirePageTenant();
  const role = session.role as RoleName;
  const enums = (await getMessages()).enums as DictEnums;
  const tc = await getTranslations("contrats");
  const tf = await getTranslations("finances");
  const tcom = await getTranslations("commun");

  if (!can(role, "A", "lire")) {
    return (
      <main>
        <Nav />
        <p role="alert">{tcom("accesRefuse")}</p>
      </main>
    );
  }

  const data = await withTenant(s.app, ctx, async (tx) => {
    const contrat = await getContrat(tx, ctx.organisationId, id);
    if (!contrat) return null;
    const [appels, paiements, actions] = [
      await listAppels(tx, ctx.organisationId, { contratId: id }),
      await listPaiements(tx, ctx.organisationId, { contratId: id }),
      await listActionsRecouvrement(tx, ctx.organisationId, id),
    ];
    return { contrat, appels, paiements, actions };
  });

  if (!data) notFound();
  const { contrat, appels, paiements, actions } = data;
  const peutCreer = can(role, "A", "creer");

  return (
    <main>
      <Nav />
      <p>
        <Link href="/contrats">{tcom("retour")}</Link>
      </p>
      <h1>
        {tc("detail")} — {contrat.reference}
      </h1>
      <p className="meta">
        {tc("statut")} : <strong>{libelleEnum(enums, "statutContrat", contrat.statut)}</strong> — {tc("dateDebut")} :{" "}
        {jour(contrat.dateDebut)}
      </p>

      <section className="card" aria-label={tf("appels")}>
        <h2>{tf("appels")}</h2>
        {appels.length === 0 ? (
          <p>{tf("aucunAppel")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{tf("periode")}</th>
                <th scope="col">{tf("echeance")}</th>
                <th scope="col">{tf("montant")}</th>
                <th scope="col">{tf("impute")}</th>
                <th scope="col">{tf("solde")}</th>
              </tr>
            </thead>
            <tbody>
              {appels.map((a) => (
                <tr key={a.id}>
                  <td>{a.periode}</td>
                  <td>{jour(a.dateEcheance)}</td>
                  <td>{dzd(a.montantCentimes)}</td>
                  <td>{dzd(a.imputeCentimes)}</td>
                  <td>
                    <strong>{dzd(a.soldeCentimes)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card" aria-label={tf("paiements")} style={{ marginTop: 16 }}>
        <h2>{tf("paiements")}</h2>
        {paiements.length === 0 ? (
          <p>{tf("aucunPaiement")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{tf("date")}</th>
                <th scope="col">{tf("mode")}</th>
                <th scope="col">{tf("reference")}</th>
                <th scope="col">{tf("montant")}</th>
                <th scope="col">{tf("reste")}</th>
              </tr>
            </thead>
            <tbody>
              {paiements.map((p) => (
                <tr key={p.id}>
                  <td>{jour(p.datePaiement)}</td>
                  <td>{libelleEnum(enums, "modePaiement", p.mode)}</td>
                  <td>{p.reference ?? "—"}</td>
                  <td>{dzd(p.montantCentimes)}</td>
                  <td>{dzd(p.resteCentimes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card" aria-label={tf("recouvrement")} style={{ marginTop: 16 }}>
        <h2>{tf("recouvrement")}</h2>
        {actions.length === 0 ? (
          <p>{tf("aucuneAction")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{tf("date")}</th>
                <th scope="col">{tf("type")}</th>
                <th scope="col">{tf("note")}</th>
                <th scope="col">{tf("piece")}</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id}>
                  <td>{jour(a.date)}</td>
                  <td>{libelleEnum(enums, "typeActionRecouvrement", a.type)}</td>
                  <td>{a.note ?? "—"}</td>
                  <td>{a.pieceReference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {peutCreer && (
        <ContratActions
          contratId={contrat.id}
          appels={appels.map((a) => ({ id: a.id, periode: a.periode, soldeCentimes: a.soldeCentimes }))}
          paiements={paiements.map((p) => ({ id: p.id, reference: p.reference, resteCentimes: p.resteCentimes }))}
        />
      )}
    </main>
  );
}
