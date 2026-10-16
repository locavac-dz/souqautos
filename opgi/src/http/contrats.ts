// Handlers HTTP des contrats — collection et élément.
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authorize } from "@/http/guard";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import { contratCreateSchema, contratUpdateSchema } from "@/lib/modules/a/schemas";
import {
  listContrats,
  createContrat,
  getContrat,
  updateContrat,
  archiveContrat,
} from "@/lib/modules/a/service";

export async function handleContrats(request: Request, s: Services): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorize(request, s, "A", "creer");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, contratCreateSchema);
    if (body instanceof Response) return body;
    try {
      const contrat = await withTenant(s.app, auth.ctx, (tx) =>
        createContrat(tx, auth.ctx.organisationId, body),
      );
      return json(201, { contrat });
    } catch (e) {
      return mapError(e);
    }
  }

  const auth = await authorize(request, s, "A", "lire");
  if (auth instanceof Response) return auth;
  const inclureArchives = new URL(request.url).searchParams.get("archives") === "1";
  const contrats = await withTenant(s.app, auth.ctx, (tx) =>
    listContrats(tx, auth.ctx.organisationId, inclureArchives),
  );
  return json(200, { contrats });
}

export async function handleContrat(request: Request, s: Services, id: string): Promise<Response> {
  if (request.method === "GET") {
    const auth = await authorize(request, s, "A", "lire");
    if (auth instanceof Response) return auth;
    const contrat = await withTenant(s.app, auth.ctx, (tx) =>
      getContrat(tx, auth.ctx.organisationId, id),
    );
    return contrat ? json(200, { contrat }) : json(404, { error: "Introuvable." });
  }

  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  if (request.method === "PATCH") {
    const auth = await authorize(request, s, "A", "modifier");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, contratUpdateSchema);
    if (body instanceof Response) return body;
    try {
      const contrat = await withTenant(s.app, auth.ctx, (tx) =>
        updateContrat(tx, auth.ctx.organisationId, id, body),
      );
      return contrat ? json(200, { contrat }) : json(404, { error: "Introuvable." });
    } catch (e) {
      return mapError(e);
    }
  }

  if (request.method === "DELETE") {
    const auth = await authorize(request, s, "A", "modifier");
    if (auth instanceof Response) return auth;
    const ok = await withTenant(s.app, auth.ctx, (tx) =>
      archiveContrat(tx, auth.ctx.organisationId, id),
    );
    return ok ? json(200, { archive: true }) : json(404, { error: "Introuvable." });
  }

  return json(405, { error: "Méthode non autorisée." });
}
