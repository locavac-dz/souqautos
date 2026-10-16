// Handlers HTTP des marchés, situations de travaux et réceptions (Module B).
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authorize } from "@/http/guard";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import {
  marcheCreateSchema,
  marcheUpdateSchema,
  situationCreateSchema,
  situationDecisionSchema,
  receptionCreateSchema,
} from "@/lib/modules/b/schemas";
import { recordAudit } from "@/lib/audit";
import {
  listMarches,
  countMarches,
  createMarche,
  getMarcheDetail,
  updateMarche,
  archiveMarche,
  listSituations,
  createSituation,
  deciderSituation,
  listReceptions,
  createReception,
} from "@/lib/modules/b/service";
import { parseListParams, pageHeaders } from "@/http/pagination";

// --- Marchés ----------------------------------------------------------------
export async function handleMarches(request: Request, s: Services): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorize(request, s, "B", "creer");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, marcheCreateSchema);
    if (body instanceof Response) return body;
    try {
      const marche = await withTenant(s.app, auth.ctx, async (tx) => {
        const r = await createMarche(tx, auth.ctx.organisationId, body);
        await recordAudit(tx, auth.ctx.organisationId, {
          utilisateurId: auth.session.utilisateurId,
          action: "marche.create",
          objetType: "Marche",
          objetId: r.id,
          resume: `${r.reference} — ${r.montantCentimes} centimes`,
        });
        return r;
      });
      return json(201, { marche });
    } catch (e) {
      return mapError(e);
    }
  }
  const auth = await authorize(request, s, "B", "lire");
  if (auth instanceof Response) return auth;
  const projetId = new URL(request.url).searchParams.get("projet") ?? undefined;
  const p = parseListParams(request.url);
  const opts = { projetId, q: p.q, skip: p.skip, take: p.take };
  const [marches, total] = await withTenant(s.app, auth.ctx, async (tx) => [
    await listMarches(tx, auth.ctx.organisationId, opts),
    await countMarches(tx, auth.ctx.organisationId, opts),
  ]);
  return json(200, { marches }, { headers: pageHeaders(total, p) });
}

export async function handleMarche(request: Request, s: Services, id: string): Promise<Response> {
  if (request.method === "GET") {
    const auth = await authorize(request, s, "B", "lire");
    if (auth instanceof Response) return auth;
    const detail = await withTenant(s.app, auth.ctx, (tx) => getMarcheDetail(tx, auth.ctx.organisationId, id));
    return detail ? json(200, detail) : json(404, { error: "Introuvable." });
  }
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  if (request.method === "PATCH") {
    const auth = await authorize(request, s, "B", "modifier");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, marcheUpdateSchema);
    if (body instanceof Response) return body;
    const marche = await withTenant(s.app, auth.ctx, (tx) => updateMarche(tx, auth.ctx.organisationId, id, body));
    return marche ? json(200, { marche }) : json(404, { error: "Introuvable." });
  }
  if (request.method === "DELETE") {
    const auth = await authorize(request, s, "B", "modifier");
    if (auth instanceof Response) return auth;
    const ok = await withTenant(s.app, auth.ctx, (tx) => archiveMarche(tx, auth.ctx.organisationId, id));
    return ok ? json(200, { archive: true }) : json(404, { error: "Introuvable." });
  }
  return json(405, { error: "Méthode non autorisée." });
}

// --- Situations de travaux (sous un marché) ---------------------------------
export async function handleSituations(request: Request, s: Services, marcheId: string): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorize(request, s, "B", "creer");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, situationCreateSchema);
    if (body instanceof Response) return body;
    try {
      const situation = await withTenant(s.app, auth.ctx, (tx) =>
        createSituation(tx, auth.ctx.organisationId, marcheId, body),
      );
      return json(201, { situation });
    } catch (e) {
      return mapError(e);
    }
  }
  const auth = await authorize(request, s, "B", "lire");
  if (auth instanceof Response) return auth;
  const situations = await withTenant(s.app, auth.ctx, (tx) => listSituations(tx, auth.ctx.organisationId, marcheId));
  return json(200, { situations });
}

// POST /api/situations/:id/decision — VALIDEE exige la permission « valider ».
export async function handleSituationDecision(request: Request, s: Services, id: string): Promise<Response> {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  if (request.method !== "POST") return json(405, { error: "Méthode non autorisée." });

  const body = await parseBody(request, situationDecisionSchema);
  if (body instanceof Response) return body;

  // La validation d'une situation est un acte distinct (délégation) : elle exige
  // « valider » ; la vérification ou le rejet relèvent de « modifier ».
  const action = body.decision === "VALIDEE" ? "valider" : "modifier";
  const auth = await authorize(request, s, "B", action);
  if (auth instanceof Response) return auth;

  const situation = await withTenant(s.app, auth.ctx, async (tx) => {
    const r = await deciderSituation(
      tx,
      auth.ctx.organisationId,
      id,
      body.decision,
      auth.session.utilisateurId,
      body.observations,
    );
    if (r) {
      await recordAudit(tx, auth.ctx.organisationId, {
        utilisateurId: auth.session.utilisateurId,
        action: `situation.${body.decision.toLowerCase()}`,
        objetType: "SituationTravaux",
        objetId: r.id,
        resume: `n°${r.numero} — ${r.montantTravauxCentimes} centimes`,
      });
    }
    return r;
  });
  return situation ? json(200, { situation }) : json(404, { error: "Introuvable." });
}

// --- Réceptions (sous un marché) --------------------------------------------
export async function handleReceptions(request: Request, s: Services, marcheId: string): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorize(request, s, "B", "modifier");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, receptionCreateSchema);
    if (body instanceof Response) return body;
    try {
      const reception = await withTenant(s.app, auth.ctx, async (tx) => {
        const r = await createReception(tx, auth.ctx.organisationId, marcheId, body);
        await recordAudit(tx, auth.ctx.organisationId, {
          utilisateurId: auth.session.utilisateurId,
          action: "reception.create",
          objetType: "Reception",
          objetId: r.id,
          resume: `${r.type}${r.avecReserves ? " (avec réserves)" : ""}`,
        });
        return r;
      });
      return json(201, { reception });
    } catch (e) {
      return mapError(e);
    }
  }
  const auth = await authorize(request, s, "B", "lire");
  if (auth instanceof Response) return auth;
  const receptions = await withTenant(s.app, auth.ctx, (tx) => listReceptions(tx, auth.ctx.organisationId, marcheId));
  return json(200, { receptions });
}
