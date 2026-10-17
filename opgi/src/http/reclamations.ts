// Handlers HTTP des réclamations et de leurs commentaires (Module C).
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authorize, type AuthorizedContext } from "@/http/guard";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import {
  reclamationCreateSchema,
  reclamationQualifierSchema,
  doublonSchema,
  commentaireCreateSchema,
} from "@/lib/modules/c/schemas";
import {
  createReclamation,
  listReclamations,
  countReclamations,
  getReclamation,
  qualifierReclamation,
  marquerDoublon,
  addCommentaire,
  listCommentaires,
  type Acteur,
} from "@/lib/modules/c/service";
import { notifier } from "@/lib/modules/notifications";
import { dispatcherExterne } from "@/lib/notifications/canal";
import { parseListParams, pageHeaders } from "@/http/pagination";

function acteurDe(auth: AuthorizedContext): Acteur {
  return { utilisateurId: auth.session.utilisateurId, role: auth.session.role };
}

export async function handleReclamations(request: Request, s: Services): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorize(request, s, "C", "creer");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, reclamationCreateSchema);
    if (body instanceof Response) return body;
    try {
      const reclamation = await withTenant(s.app, auth.ctx, (tx) =>
        createReclamation(tx, auth.ctx.organisationId, acteurDe(auth), body),
      );
      return json(201, { reclamation });
    } catch (e) {
      return mapError(e);
    }
  }
  const auth = await authorize(request, s, "C", "lire");
  if (auth instanceof Response) return auth;
  const statut = new URL(request.url).searchParams.get("statut") ?? undefined;
  const p = parseListParams(request.url);
  const opts = { statut, q: p.q, skip: p.skip, take: p.take };
  const acteur = acteurDe(auth);
  const [reclamations, total] = await withTenant(s.app, auth.ctx, async (tx) => [
    await listReclamations(tx, auth.ctx.organisationId, acteur, opts),
    await countReclamations(tx, auth.ctx.organisationId, acteur, opts),
  ]);
  return json(200, { reclamations }, { headers: pageHeaders(total, p) });
}

export async function handleReclamation(request: Request, s: Services, id: string): Promise<Response> {
  if (request.method === "GET") {
    const auth = await authorize(request, s, "C", "lire");
    if (auth instanceof Response) return auth;
    const reclamation = await withTenant(s.app, auth.ctx, (tx) =>
      getReclamation(tx, auth.ctx.organisationId, acteurDe(auth), id),
    );
    return reclamation ? json(200, { reclamation }) : json(404, { error: "Introuvable." });
  }

  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  if (request.method === "PATCH") {
    const auth = await authorize(request, s, "C", "modifier");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, reclamationQualifierSchema);
    if (body instanceof Response) return body;
    const { reclamation, notif } = await withTenant(s.app, auth.ctx, async (tx) => {
      const r = await qualifierReclamation(tx, auth.ctx.organisationId, id, body);
      // Notifie le déclarant (occupant) du changement de statut de SA réclamation.
      let n = null;
      if (r && r.declarantUtilisateurId) {
        n = await notifier(tx, auth.ctx.organisationId, {
          destinataireUtilisateurId: r.declarantUtilisateurId,
          type: "reclamation.statut",
          titre: `Réclamation ${r.reference} : ${r.statut}`,
          lien: `/reclamations/${r.id}`,
        });
      }
      return { reclamation: r, notif: n };
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
    return reclamation ? json(200, { reclamation }) : json(404, { error: "Introuvable." });
  }

  return json(405, { error: "Méthode non autorisée." });
}

// POST /api/reclamations/:id/doublon
export async function handleReclamationDoublon(
  request: Request,
  s: Services,
  id: string,
): Promise<Response> {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  if (request.method !== "POST") return json(405, { error: "Méthode non autorisée." });
  const auth = await authorize(request, s, "C", "modifier");
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, doublonSchema);
  if (body instanceof Response) return body;
  try {
    const reclamation = await withTenant(s.app, auth.ctx, (tx) =>
      marquerDoublon(tx, auth.ctx.organisationId, id, body.doublonDeId),
    );
    return reclamation ? json(200, { reclamation }) : json(404, { error: "Introuvable." });
  } catch (e) {
    return mapError(e);
  }
}

// GET/POST /api/reclamations/:id/commentaires
export async function handleCommentaires(
  request: Request,
  s: Services,
  reclamationId: string,
): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorize(request, s, "C", "creer");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, commentaireCreateSchema);
    if (body instanceof Response) return body;
    try {
      const commentaire = await withTenant(s.app, auth.ctx, (tx) =>
        addCommentaire(tx, auth.ctx.organisationId, acteurDe(auth), reclamationId, body),
      );
      return json(201, { commentaire });
    } catch (e) {
      return mapError(e);
    }
  }
  const auth = await authorize(request, s, "C", "lire");
  if (auth instanceof Response) return auth;
  const commentaires = await withTenant(s.app, auth.ctx, (tx) =>
    listCommentaires(tx, auth.ctx.organisationId, acteurDe(auth), reclamationId),
  );
  return commentaires ? json(200, { commentaires }) : json(404, { error: "Introuvable." });
}
