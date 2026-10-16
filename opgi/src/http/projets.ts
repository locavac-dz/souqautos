// Handlers HTTP des projets (Module B).
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authorize } from "@/http/guard";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import { projetCreateSchema, projetUpdateSchema } from "@/lib/modules/b/schemas";
import { listProjets, countProjets, createProjet, getProjet, updateProjet, archiveProjet } from "@/lib/modules/b/service";
import { parseListParams, pageHeaders } from "@/http/pagination";

export async function handleProjets(request: Request, s: Services): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorize(request, s, "B", "creer");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, projetCreateSchema);
    if (body instanceof Response) return body;
    try {
      const projet = await withTenant(s.app, auth.ctx, (tx) => createProjet(tx, auth.ctx.organisationId, body));
      return json(201, { projet });
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
  const [projets, total] = await withTenant(s.app, auth.ctx, async (tx) => [
    await listProjets(tx, auth.ctx.organisationId, opts),
    await countProjets(tx, auth.ctx.organisationId, opts),
  ]);
  return json(200, { projets }, { headers: pageHeaders(total, p) });
}

export async function handleProjet(request: Request, s: Services, id: string): Promise<Response> {
  if (request.method === "GET") {
    const auth = await authorize(request, s, "B", "lire");
    if (auth instanceof Response) return auth;
    const projet = await withTenant(s.app, auth.ctx, (tx) => getProjet(tx, auth.ctx.organisationId, id));
    return projet ? json(200, { projet }) : json(404, { error: "Introuvable." });
  }
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  if (request.method === "PATCH") {
    const auth = await authorize(request, s, "B", "modifier");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, projetUpdateSchema);
    if (body instanceof Response) return body;
    try {
      const projet = await withTenant(s.app, auth.ctx, (tx) => updateProjet(tx, auth.ctx.organisationId, id, body));
      return projet ? json(200, { projet }) : json(404, { error: "Introuvable." });
    } catch (e) {
      return mapError(e);
    }
  }
  if (request.method === "DELETE") {
    const auth = await authorize(request, s, "B", "modifier");
    if (auth instanceof Response) return auth;
    const ok = await withTenant(s.app, auth.ctx, (tx) => archiveProjet(tx, auth.ctx.organisationId, id));
    return ok ? json(200, { archive: true }) : json(404, { error: "Introuvable." });
  }
  return json(405, { error: "Méthode non autorisée." });
}
