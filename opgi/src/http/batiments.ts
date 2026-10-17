// Handlers HTTP des bâtiments (hiérarchie du patrimoine, module A).
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authorize } from "@/http/guard";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import { batimentCreateSchema, batimentUpdateSchema } from "@/lib/modules/a/schemas";
import {
  listBatiments,
  countBatiments,
  createBatiment,
  getBatiment,
  updateBatiment,
  archiveBatiment,
} from "@/lib/modules/a/service";
import { parseListParams, pageHeaders } from "@/http/pagination";

export async function handleBatiments(request: Request, s: Services): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorize(request, s, "A", "creer");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, batimentCreateSchema);
    if (body instanceof Response) return body;
    try {
      const batiment = await withTenant(s.app, auth.ctx, (tx) =>
        createBatiment(tx, auth.ctx.organisationId, body),
      );
      return json(201, { batiment });
    } catch (e) {
      return mapError(e);
    }
  }

  const auth = await authorize(request, s, "A", "lire");
  if (auth instanceof Response) return auth;
  const url = new URL(request.url);
  const p = parseListParams(request.url);
  const siteId = url.searchParams.get("siteId");
  const opts = {
    inclureArchives: url.searchParams.get("archives") === "1",
    q: p.q,
    skip: p.skip,
    take: p.take,
    ...(siteId ? { siteId } : {}),
  };
  const [batiments, total] = await withTenant(s.app, auth.ctx, async (tx) => [
    await listBatiments(tx, auth.ctx.organisationId, opts),
    await countBatiments(tx, auth.ctx.organisationId, opts),
  ]);
  return json(200, { batiments }, { headers: pageHeaders(total, p) });
}

export async function handleBatiment(request: Request, s: Services, id: string): Promise<Response> {
  if (request.method === "GET") {
    const auth = await authorize(request, s, "A", "lire");
    if (auth instanceof Response) return auth;
    const batiment = await withTenant(s.app, auth.ctx, (tx) => getBatiment(tx, auth.ctx.organisationId, id));
    return batiment ? json(200, { batiment }) : json(404, { error: "Introuvable." });
  }

  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  if (request.method === "PATCH") {
    const auth = await authorize(request, s, "A", "modifier");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, batimentUpdateSchema);
    if (body instanceof Response) return body;
    try {
      const batiment = await withTenant(s.app, auth.ctx, (tx) =>
        updateBatiment(tx, auth.ctx.organisationId, id, body),
      );
      return batiment ? json(200, { batiment }) : json(404, { error: "Introuvable." });
    } catch (e) {
      return mapError(e);
    }
  }

  if (request.method === "DELETE") {
    const auth = await authorize(request, s, "A", "modifier");
    if (auth instanceof Response) return auth;
    const ok = await withTenant(s.app, auth.ctx, (tx) => archiveBatiment(tx, auth.ctx.organisationId, id));
    return ok ? json(200, { archive: true }) : json(404, { error: "Introuvable." });
  }

  return json(405, { error: "Méthode non autorisée." });
}
