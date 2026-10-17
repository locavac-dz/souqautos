// Handlers HTTP des ordres de travail (Module C).
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authorize, type AuthorizedContext } from "@/http/guard";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import { ordreCreateSchema, ordreUpdateSchema } from "@/lib/modules/c/schemas";
import { createOrdre, listOrdres, countOrdres, getOrdre, updateOrdre, type Acteur } from "@/lib/modules/c/service";
import { notifier } from "@/lib/modules/notifications";
import { dispatcherExterne } from "@/lib/notifications/canal";
import { parseListParams, pageHeaders } from "@/http/pagination";
import { documentPdf } from "@/lib/pdf/simple";

function acteurDe(auth: AuthorizedContext): Acteur {
  return { utilisateurId: auth.session.utilisateurId, role: auth.session.role };
}

export async function handleOrdres(request: Request, s: Services): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    // Création réservée aux rôles disposant de « modifier » (exclut l'occupant).
    const auth = await authorize(request, s, "C", "modifier");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, ordreCreateSchema);
    if (body instanceof Response) return body;
    try {
      const { ordre, notif } = await withTenant(s.app, auth.ctx, async (tx) => {
        const r = await createOrdre(tx, auth.ctx.organisationId, body);
        // Notifie l'intervenant affecté (technicien interne ou prestataire externe).
        const destinataire = r.technicienUtilisateurId ?? r.prestataireUtilisateurId;
        let n = null;
        if (destinataire) {
          n = await notifier(tx, auth.ctx.organisationId, {
            destinataireUtilisateurId: destinataire,
            type: "ot.affectation",
            titre: `Ordre de travail ${r.reference} vous est affecté`,
            lien: `/reclamations/${r.reclamationId}`,
          });
        }
        return { ordre: r, notif: n };
      });
      // Envoi externe best-effort APRÈS commit (jamais dans la transaction).
      if (notif) {
        await dispatcherExterne(s.canalNotif, s.journal, {
          organisationId: auth.ctx.organisationId,
          notificationId: notif.id,
          destinataireUtilisateurId: notif.destinataireUtilisateurId,
          type: notif.type,
          lien: notif.lien,
        });
      }
      return json(201, { ordre });
    } catch (e) {
      return mapError(e);
    }
  }
  const auth = await authorize(request, s, "C", "lire");
  if (auth instanceof Response) return auth;
  const reclamationId = new URL(request.url).searchParams.get("reclamation") ?? undefined;
  const p = parseListParams(request.url);
  const opts = { reclamationId, q: p.q, skip: p.skip, take: p.take };
  const acteur = acteurDe(auth);
  const [ordres, total] = await withTenant(s.app, auth.ctx, async (tx) => [
    await listOrdres(tx, auth.ctx.organisationId, acteur, opts),
    await countOrdres(tx, auth.ctx.organisationId, acteur, opts),
  ]);
  return json(200, { ordres }, { headers: pageHeaders(total, p) });
}

// GET /api/ordres/:id/pdf — bon d'ordre de travail (médié par propriété).
export async function handleOrdrePdf(request: Request, s: Services, id: string): Promise<Response> {
  if (request.method !== "GET") return json(405, { error: "Méthode non autorisée." });
  const auth = await authorize(request, s, "C", "lire");
  if (auth instanceof Response) return auth;
  const ot = await withTenant(s.app, auth.ctx, (tx) =>
    getOrdre(tx, auth.ctx.organisationId, acteurDe(auth), id),
  );
  if (!ot) return json(404, { error: "Introuvable." });

  const dzd = (c: number | null) =>
    c != null ? `${(c / 100).toLocaleString("fr-DZ", { minimumFractionDigits: 2 })} DA` : "—";
  const jour = (dt: Date | null) => (dt ? dt.toISOString().slice(0, 10) : "—");
  const pdf = documentPdf({
    titre: `Bon d'ordre de travail ${ot.reference}`,
    sousTitre: `Édité le ${new Date().toISOString().slice(0, 10)} — document de données (à valider)`,
    lignes: [
      { label: "Référence", valeur: ot.reference },
      { label: "Statut", valeur: ot.statut },
      { label: "Affectation", valeur: ot.affectationType ?? "—" },
      { label: "Prestataire", valeur: ot.prestataireNom ?? "—" },
      { label: "Date planifiée", valeur: jour(ot.datePlanifiee) },
      { label: "Coût estimé", valeur: dzd(ot.coutEstimeCentimes) },
      { label: "Coût constaté", valeur: dzd(ot.coutConstateCentimes) },
      { label: "Compte rendu", valeur: ot.compteRendu ?? "—" },
    ],
    pied: "Plateforme OPGI — bon de travail non contractuel.",
  });

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="ordre-${ot.reference}.pdf"`,
    },
  });
}

export async function handleOrdre(request: Request, s: Services, id: string): Promise<Response> {
  if (request.method === "GET") {
    const auth = await authorize(request, s, "C", "lire");
    if (auth instanceof Response) return auth;
    const ordre = await withTenant(s.app, auth.ctx, (tx) =>
      getOrdre(tx, auth.ctx.organisationId, acteurDe(auth), id),
    );
    return ordre ? json(200, { ordre }) : json(404, { error: "Introuvable." });
  }

  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  if (request.method === "PATCH") {
    const auth = await authorize(request, s, "C", "modifier");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, ordreUpdateSchema);
    if (body instanceof Response) return body;
    const ordre = await withTenant(s.app, auth.ctx, (tx) =>
      updateOrdre(tx, auth.ctx.organisationId, acteurDe(auth), id, body),
    );
    return ordre ? json(200, { ordre }) : json(404, { error: "Introuvable." });
  }

  return json(405, { error: "Méthode non autorisée." });
}
