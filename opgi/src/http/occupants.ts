// Handlers HTTP des occupants — collection et élément.
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authorize } from "@/http/guard";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import { occupantCreateSchema, occupantUpdateSchema } from "@/lib/modules/a/schemas";
import {
  listOccupants,
  createOccupant,
  getOccupant,
  updateOccupant,
  archiveOccupant,
} from "@/lib/modules/a/service";

export async function handleOccupants(request: Request, s: Services): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorize(request, s, "A", "creer");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, occupantCreateSchema);
    if (body instanceof Response) return body;
    try {
      const occupant = await withTenant(s.app, auth.ctx, (tx) =>
        createOccupant(tx, auth.ctx.organisationId, body),
      );
      return json(201, { occupant });
    } catch (e) {
      return mapError(e);
    }
  }

  const auth = await authorize(request, s, "A", "lire");
  if (auth instanceof Response) return auth;
  const inclureArchives = new URL(request.url).searchParams.get("archives") === "1";
  const occupants = await withTenant(s.app, auth.ctx, (tx) =>
    listOccupants(tx, auth.ctx.organisationId, inclureArchives),
  );
  return json(200, { occupants });
}

export async function handleOccupant(request: Request, s: Services, id: string): Promise<Response> {
  if (request.method === "GET") {
    const auth = await authorize(request, s, "A", "lire");
    if (auth instanceof Response) return auth;
    const occupant = await withTenant(s.app, auth.ctx, (tx) =>
      getOccupant(tx, auth.ctx.organisationId, id),
    );
    return occupant ? json(200, { occupant }) : json(404, { error: "Introuvable." });
  }

  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  if (request.method === "PATCH") {
    const auth = await authorize(request, s, "A", "modifier");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, occupantUpdateSchema);
    if (body instanceof Response) return body;
    try {
      const occupant = await withTenant(s.app, auth.ctx, (tx) =>
        updateOccupant(tx, auth.ctx.organisationId, id, body),
      );
      return occupant ? json(200, { occupant }) : json(404, { error: "Introuvable." });
    } catch (e) {
      return mapError(e);
    }
  }

  if (request.method === "DELETE") {
    const auth = await authorize(request, s, "A", "modifier");
    if (auth instanceof Response) return auth;
    const ok = await withTenant(s.app, auth.ctx, (tx) =>
      archiveOccupant(tx, auth.ctx.organisationId, id),
    );
    return ok ? json(200, { archive: true }) : json(404, { error: "Introuvable." });
  }

  return json(405, { error: "Méthode non autorisée." });
}
