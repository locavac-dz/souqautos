import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageTenant } from "@/lib/auth/page-guard";
import { withTenant } from "@/lib/tenant/prisma";
import { getReclamation, listCommentaires, listOrdres, type Acteur } from "@/lib/modules/c/service";
import { listPieces } from "@/lib/modules/c/pieces";
import { can, type RoleName } from "@/lib/authz/permissions";
import { Nav } from "@/app/_components/Nav";
import { ReclamationActions } from "@/app/reclamations/[id]/_ReclamationActions";
import { UploadPiece } from "@/app/reclamations/[id]/_UploadPiece";

export const dynamic = "force-dynamic";

function jour(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export default async function ReclamationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, s, ctx } = await requirePageTenant();
  const t = await getTranslations("reclamations");
  const tcom = await getTranslations("commun");
  const role = session.role as RoleName;
  const acteur: Acteur = { utilisateurId: session.utilisateurId, role: session.role };

  if (!can(role, "C", "lire")) {
    return (
      <main>
        <Nav />
        <p role="alert">{tcom("accesRefuse")}</p>
      </main>
    );
  }

  const data = await withTenant(s.app, ctx, async (tx) => {
    const reclamation = await getReclamation(tx, ctx.organisationId, acteur, id);
    if (!reclamation) return null;
    return {
      reclamation,
      commentaires: (await listCommentaires(tx, ctx.organisationId, acteur, id)) ?? [],
      ordres: await listOrdres(tx, ctx.organisationId, acteur, { reclamationId: id }),
      pieces: (await listPieces(tx, ctx.organisationId, acteur, id)) ?? [],
    };
  });

  if (!data) notFound();
  const { reclamation, commentaires, ordres, pieces } = data;

  return (
    <main>
      <Nav />
      <p>
        <Link href="/reclamations">{tcom("retour")}</Link>
      </p>
      <h1>
        {t("detail")} — {reclamation.reference}
      </h1>
      <p className="meta">
        {t("categorie")} : <strong>{reclamation.categorie}</strong> — {t("urgence")} :{" "}
        <strong>{reclamation.urgence}</strong> — {t("statut")} : <strong>{reclamation.statut}</strong>
      </p>
      <section className="card">
        <p>{reclamation.description}</p>
        {reclamation.localisation && (
          <p className="meta">
            {t("localisation")} : {reclamation.localisation}
          </p>
        )}
      </section>

      <section className="card" aria-label={t("commentaires")} style={{ marginTop: 16 }}>
        <h2>{t("commentaires")}</h2>
        {commentaires.length === 0 ? (
          <p>{t("aucunCommentaire")}</p>
        ) : (
          <ul>
            {commentaires.map((c) => (
              <li key={c.id}>
                {c.interne ? "🔒 " : ""}
                {c.texte}{" "}
                <span className="meta">({jour(c.createdAt)})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-label={t("ordres")} style={{ marginTop: 16 }}>
        <h2>{t("ordres")}</h2>
        {ordres.length === 0 ? (
          <p>{t("aucunOrdre")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("reference")}</th>
                <th scope="col">{t("statut")}</th>
                <th scope="col">{t("affectation")}</th>
                <th scope="col">{t("datePlanifiee")}</th>
              </tr>
            </thead>
            <tbody>
              {ordres.map((o) => (
                <tr key={o.id}>
                  <td>{o.reference}</td>
                  <td>{o.statut}</td>
                  <td>{o.affectationType ?? "—"}</td>
                  <td>{jour(o.datePlanifiee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card" aria-label={t("pieces")} style={{ marginTop: 16 }}>
        <h2>{t("pieces")}</h2>
        {pieces.length === 0 ? (
          <p>{t("aucunePiece")}</p>
        ) : (
          <ul>
            {pieces.map((p) => (
              <li key={p.id}>
                <a href={`/api/pieces/${p.id}`}>{p.nomFichier}</a>{" "}
                <span className="meta">
                  ({p.typeMime}, {Math.ceil(p.tailleOctets / 1024)} Ko)
                </span>
              </li>
            ))}
          </ul>
        )}
        {can(role, "C", "creer") && <UploadPiece reclamationId={reclamation.id} />}
      </section>

      <ReclamationActions
        reclamationId={reclamation.id}
        canCreer={can(role, "C", "creer")}
        canModifier={can(role, "C", "modifier")}
      />
    </main>
  );
}
