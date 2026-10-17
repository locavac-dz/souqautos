import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getMessages } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { getMarcheDetail, listSituations, listReceptions } from "@/lib/modules/b/service";
import { can, type RoleName } from "@/lib/authz/permissions";
import { libelleEnum, type DictEnums } from "@/i18n/enums";
import { Nav } from "@/app/_components/Nav";
import { MarcheActions } from "@/app/marches/[id]/_MarcheActions";

export const dynamic = "force-dynamic";

function dzd(c: number): string {
  return (c / 100).toLocaleString("fr-DZ", { minimumFractionDigits: 2 });
}
function jour(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export default async function MarcheDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, s, ctx } = await requirePageTenant();
  const t = await getTranslations("marches");
  const tcom = await getTranslations("commun");
  const enums = (await getMessages()).enums as DictEnums;
  const role = session.role as RoleName;

  if (!can(role, "B", "lire")) {
    return (
      <main>
        <Nav />
        <p role="alert">Votre rôle ne permet pas d'accéder au module B.</p>
      </main>
    );
  }

  const data = await withTenant(s.app, ctx, async (tx) => {
    const detail = await getMarcheDetail(tx, ctx.organisationId, id);
    if (!detail) return null;
    return {
      detail,
      situations: await listSituations(tx, ctx.organisationId, id),
      receptions: await listReceptions(tx, ctx.organisationId, id),
    };
  });

  if (!data) notFound();
  const { detail, situations, receptions } = data;

  return (
    <main>
      <Nav />
      <p>
        <Link href="/marches">{tcom("retour")}</Link>
      </p>
      <h1>
        {t("detail")} — {detail.marche.reference}
      </h1>
      <p className="meta">
        {detail.marche.objet} — {t("statut")} : <strong>{libelleEnum(enums, "statutMarche", detail.marche.statut)}</strong>
      </p>
      <p>
        <a href={`/api/marches/${id}/pdf`}>{t("telechargerPdf")}</a>
      </p>

      <section className="card" aria-label={t("avancement")}>
        <h2>{t("avancement")}</h2>
        <p>
          {t("engage")} : <strong>{dzd(detail.montantEngageCentimes)}</strong> — {t("constate")} :{" "}
          <strong>{dzd(detail.montantConstateValideCentimes)}</strong>
        </p>
        <p>
          {t("avancementFinancier")} : <strong>{detail.avancementFinancierPct}%</strong>
          {detail.avancementPhysiquePct != null && (
            <>
              {" "}
              — {t("avancementPhysique")} : <strong>{detail.avancementPhysiquePct}%</strong>
            </>
          )}
        </p>
        {(detail.depassement || detail.retard) && (
          <p className="erreur" role="alert">
            {detail.depassement ? `⚠ ${t("depassement")}. ` : ""}
            {detail.retard ? `⚠ ${t("retard")}.` : ""}
          </p>
        )}
        <p className="meta">{t("alerteAide")}</p>
        <p className="meta">{t("paiementNote")}</p>
      </section>

      <section className="card" aria-label={t("situations")} style={{ marginTop: 16 }}>
        <h2>{t("situations")}</h2>
        {situations.length === 0 ? (
          <p>{t("aucuneSituation")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("numero")}</th>
                <th scope="col">{t("periode")}</th>
                <th scope="col">{t("montantTravaux")}</th>
                <th scope="col">{t("avancementPct")}</th>
                <th scope="col">{t("situationStatut")}</th>
              </tr>
            </thead>
            <tbody>
              {situations.map((x) => (
                <tr key={x.id}>
                  <td>{x.numero}</td>
                  <td>{x.periode ?? "—"}</td>
                  <td>{dzd(x.montantTravauxCentimes)}</td>
                  <td>{x.avancementPhysiquePct ?? "—"}</td>
                  <td>{libelleEnum(enums, "statutSituation", x.statut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card" aria-label={t("receptions")} style={{ marginTop: 16 }}>
        <h2>{t("receptions")}</h2>
        {receptions.length === 0 ? (
          <p>{t("aucuneReception")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("type")}</th>
                <th scope="col">{t("date")}</th>
                <th scope="col">{t("avecReserves")}</th>
                <th scope="col">{t("pv")}</th>
              </tr>
            </thead>
            <tbody>
              {receptions.map((r) => (
                <tr key={r.id}>
                  <td>{libelleEnum(enums, "typeReception", r.type)}</td>
                  <td>{jour(r.date)}</td>
                  <td>{r.avecReserves ? "Oui" : "Non"}</td>
                  <td>{r.pvReference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <MarcheActions
        marcheId={detail.marche.id}
        situations={situations.map((x) => ({ id: x.id, numero: x.numero, statut: x.statut }))}
        canCreer={can(role, "B", "creer")}
        canModifier={can(role, "B", "modifier")}
      />
    </main>
  );
}
