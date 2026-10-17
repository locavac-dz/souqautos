// Handlers HTTP des entreprises (Module B).
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authorize } from "@/http/guard";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import { entrepriseCreateSchema, entrepriseUpdateSchema } from "@/lib/modules/b/schemas";
import {
  listEntreprises,
  countEntreprises,
  createEntreprise,
  getEntreprise,
  updateEntreprise,
  archiveEntreprise,
} from "@/lib/modules/b/service";
import { parseListParams, pageHeaders } from "@/http/pagination";

export async function handleEntreprises(request: Request, s: Services): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorize(request, s, "B", "creer");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, entrepriseCreateSchema);
    if (body instanceof Response) return body;
    try {
      const entreprise = await withTenant(s.app, auth.ctx, (tx) => createEntreprise(tx, auth.ctx.organisationId, body));
      return json(201, { entreprise });
    } catch (e) {
      return mapError(e);
    }
  }
  const auth = await authorize(request, s, "B", "lire");
  if (auth instanceof Response) return auth;
  const p = parseListParams(request.url);
  const opts = {
    inclureArchives: new URL(request.url).searchParams.get("archives") === "1",
    q: p.q,
    skip: p.skip,
    take: p.take,
  };
  const [entreprises, total] = await withTenant(s.app, auth.ctx, async (tx) => [
    await listEntreprises(tx, auth.ctx.organisationId, opts),
    await countEntreprises(tx, auth.ctx.organisationId, opts),
  ]);
  return json(200, { entreprises }, { headers: pageHeaders(total, p) });
}

export async function handleEntreprise(request: Request, s: Services, id: string): Promise<Response> {
  if (request.method === "GET") {
    const auth = await authorize(request, s, "B", "lire");
    if (auth instanceof Response) return auth;
    const entreprise = await withTenant(s.app, auth.ctx, (tx) => getEntreprise(tx, auth.ctx.organisationId, id));
    return entreprise ? json(200, { entreprise }) : json(404, { error: "Introuvable." });
  }
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  if (request.method === "PATCH") {
    const auth = await authorize(request, s, "B", "modifier");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, entrepriseUpdateSchema);
    if (body instanceof Response) return body;
    try {
      const entreprise = await withTenant(s.app, auth.ctx, (tx) => updateEntreprise(tx, auth.ctx.organisationId, id, body));
      return entreprise ? json(200, { entreprise }) : json(404, { error: "Introuvable." });
    } catch (e) {
      return mapError(e);
    }
  }
  if (request.method === "DELETE") {
    const auth = await authorize(request, s, "B", "modifier");
    if (auth instanceof Response) return auth;
    const ok = await withTenant(s.app, auth.ctx, (tx) => archiveEntreprise(tx, auth.ctx.organisationId, id));
    return ok ? json(200, { archive: true }) : json(404, { error: "Introuvable." });
  }
  return json(405, { error: "Méthode non autorisée." });
}
