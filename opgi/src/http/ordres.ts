// Handlers HTTP des ordres de travail (Module C).
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authorize, type AuthorizedContext } from "@/http/guard";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import { ordreCreateSchema, ordreUpdateSchema } from "@/lib/modules/c/schemas";
import { createOrdre, listOrdres, countOrdres, getOrdre, updateOrdre, type Acteur } from "@/lib/modules/c/service";
import { notifier } from "@/lib/modules/notifications";
import { parseListParams, pageHeaders } from "@/http/pagination";

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
      const ordre = await withTenant(s.app, auth.ctx, async (tx) => {
        const r = await createOrdre(tx, auth.ctx.organisationId, body);
        // Notifie le technicien interne affecté.
        if (r.technicienUtilisateurId) {
          await notifier(tx, auth.ctx.organisationId, {
            destinataireUtilisateurId: r.technicienUtilisateurId,
            type: "ot.affectation",
            titre: `Ordre de travail ${r.reference} vous est affecté`,
            lien: `/reclamations/${r.reclamationId}`,
          });
        }
        return r;
      });
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
