// Handlers HTTP des sites (hiérarchie du patrimoine, module A).
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authorize } from "@/http/guard";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import { siteCreateSchema, siteUpdateSchema } from "@/lib/modules/a/schemas";
import { listSites, countSites, createSite, getSite, updateSite, archiveSite } from "@/lib/modules/a/service";
import { parseListParams, pageHeaders } from "@/http/pagination";

export async function handleSites(request: Request, s: Services): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorize(request, s, "A", "creer");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, siteCreateSchema);
    if (body instanceof Response) return body;
    try {
      const site = await withTenant(s.app, auth.ctx, (tx) => createSite(tx, auth.ctx.organisationId, body));
      return json(201, { site });
    } catch (e) {
      return mapError(e);
    }
  }

  const auth = await authorize(request, s, "A", "lire");
  if (auth instanceof Response) return auth;
  const p = parseListParams(request.url);
  const opts = {
    inclureArchives: new URL(request.url).searchParams.get("archives") === "1",
    q: p.q,
    skip: p.skip,
    take: p.take,
  };
  const [sites, total] = await withTenant(s.app, auth.ctx, async (tx) => [
    await listSites(tx, auth.ctx.organisationId, opts),
    await countSites(tx, auth.ctx.organisationId, opts),
  ]);
  return json(200, { sites }, { headers: pageHeaders(total, p) });
}

export async function handleSite(request: Request, s: Services, id: string): Promise<Response> {
  if (request.method === "GET") {
    const auth = await authorize(request, s, "A", "lire");
    if (auth instanceof Response) return auth;
    const site = await withTenant(s.app, auth.ctx, (tx) => getSite(tx, auth.ctx.organisationId, id));
    return site ? json(200, { site }) : json(404, { error: "Introuvable." });
  }

  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  if (request.method === "PATCH") {
    const auth = await authorize(request, s, "A", "modifier");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, siteUpdateSchema);
    if (body instanceof Response) return body;
    try {
      const site = await withTenant(s.app, auth.ctx, (tx) => updateSite(tx, auth.ctx.organisationId, id, body));
      return site ? json(200, { site }) : json(404, { error: "Introuvable." });
    } catch (e) {
      return mapError(e);
    }
  }

  if (request.method === "DELETE") {
    const auth = await authorize(request, s, "A", "modifier");
    if (auth instanceof Response) return auth;
    const ok = await withTenant(s.app, auth.ctx, (tx) => archiveSite(tx, auth.ctx.organisationId, id));
    return ok ? json(200, { archive: true }) : json(404, { error: "Introuvable." });
  }

  return json(405, { error: "Méthode non autorisée." });
}
