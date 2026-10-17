// Handlers HTTP du patrimoine (Bien) — collection et élément.
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authorize } from "@/http/guard";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import { bienCreateSchema, bienUpdateSchema } from "@/lib/modules/a/schemas";
import { listBiens, countBiens, createBien, getBien, updateBien, archiveBien } from "@/lib/modules/a/service";
import { parseListParams, pageHeaders } from "@/http/pagination";

// GET /api/biens — liste ; POST /api/biens — création.
export async function handleBiens(request: Request, s: Services): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorize(request, s, "A", "creer");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, bienCreateSchema);
    if (body instanceof Response) return body;
    try {
      const bien = await withTenant(s.app, auth.ctx, (tx) =>
        createBien(tx, auth.ctx.organisationId, body),
      );
      return json(201, { bien });
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
  const [biens, total] = await withTenant(s.app, auth.ctx, async (tx) => [
    await listBiens(tx, auth.ctx.organisationId, opts),
    await countBiens(tx, auth.ctx.organisationId, opts),
  ]);
  return json(200, { organisationId: auth.ctx.organisationId, biens }, { headers: pageHeaders(total, p) });
}

// GET/PATCH/DELETE /api/biens/:id
export async function handleBien(request: Request, s: Services, id: string): Promise<Response> {
  if (request.method === "GET") {
    const auth = await authorize(request, s, "A", "lire");
    if (auth instanceof Response) return auth;
    const bien = await withTenant(s.app, auth.ctx, (tx) => getBien(tx, auth.ctx.organisationId, id));
    return bien ? json(200, { bien }) : json(404, { error: "Introuvable." });
  }

  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  if (request.method === "PATCH") {
    const auth = await authorize(request, s, "A", "modifier");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, bienUpdateSchema);
    if (body instanceof Response) return body;
    try {
      const bien = await withTenant(s.app, auth.ctx, (tx) =>
        updateBien(tx, auth.ctx.organisationId, id, body),
      );
      return bien ? json(200, { bien }) : json(404, { error: "Introuvable." });
    } catch (e) {
      return mapError(e);
    }
  }

  if (request.method === "DELETE") {
    const auth = await authorize(request, s, "A", "modifier");
    if (auth instanceof Response) return auth;
    const ok = await withTenant(s.app, auth.ctx, (tx) =>
      archiveBien(tx, auth.ctx.organisationId, id),
    );
    return ok ? json(200, { archive: true }) : json(404, { error: "Introuvable." });
  }

  return json(405, { error: "Méthode non autorisée." });
}
