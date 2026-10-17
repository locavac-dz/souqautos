// Handlers HTTP des finances du Module A : appels, paiements, imputations,
// recouvrement. Mêmes gardes (session → organisme → autorisation) et même
// isolation (withTenant) que le reste du module.
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authorize } from "@/http/guard";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import {
  appelCreateSchema,
  appelsGenererSchema,
  paiementCreateSchema,
  imputationCreateSchema,
  actionRecouvrementCreateSchema,
} from "@/lib/modules/a/schemas";
import { recordAudit } from "@/lib/audit";
import {
  createAppel,
  genererAppels,
  listAppels,
  archiveAppel,
  createPaiement,
  listPaiements,
  archivePaiement,
  createImputation,
  deleteImputation,
  listImpayes,
  createActionRecouvrement,
  listActionsRecouvrement,
} from "@/lib/modules/a/finances";

function contratParam(request: Request): string | undefined {
  return new URL(request.url).searchParams.get("contrat") ?? undefined;
}

// --- Appels de loyers -------------------------------------------------------
export async function handleAppels(request: Request, s: Services): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorize(request, s, "A", "creer");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, appelCreateSchema);
    if (body instanceof Response) return body;
    try {
      const appel = await withTenant(s.app, auth.ctx, (tx) =>
        createAppel(tx, auth.ctx.organisationId, body),
      );
      return json(201, { appel });
    } catch (e) {
      return mapError(e);
    }
  }
  const auth = await authorize(request, s, "A", "lire");
  if (auth instanceof Response) return auth;
  const appels = await withTenant(s.app, auth.ctx, (tx) =>
    listAppels(tx, auth.ctx.organisationId, { contratId: contratParam(request) }),
  );
  return json(200, { appels });
}

// Génération en masse des appels d'une période (un appel par contrat actif).
export async function handleAppelsGenerer(request: Request, s: Services): Promise<Response> {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  if (request.method !== "POST") return json(405, { error: "Méthode non autorisée." });
  const auth = await authorize(request, s, "A", "creer");
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, appelsGenererSchema);
  if (body instanceof Response) return body;
  try {
    const resume = await withTenant(s.app, auth.ctx, async (tx) => {
      const r = await genererAppels(tx, auth.ctx.organisationId, body);
      await recordAudit(tx, auth.ctx.organisationId, {
        utilisateurId: auth.session.utilisateurId,
        action: "appel.generer",
        objetType: "AppelLoyer",
        objetId: r.periode,
        resume: `période ${r.periode} : ${r.crees} créé(s), ${r.ignoresExistants} existant(s), ${r.ignoresSansLoyer} sans loyer`,
      });
      return r;
    });
    return json(201, { resume });
  } catch (e) {
    return mapError(e);
  }
}

export async function handleAppel(request: Request, s: Services, id: string): Promise<Response> {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  if (request.method === "DELETE") {
    const auth = await authorize(request, s, "A", "modifier");
    if (auth instanceof Response) return auth;
    const ok = await withTenant(s.app, auth.ctx, (tx) =>
      archiveAppel(tx, auth.ctx.organisationId, id),
    );
    return ok ? json(200, { archive: true }) : json(404, { error: "Introuvable." });
  }
  return json(405, { error: "Méthode non autorisée." });
}

// --- Paiements --------------------------------------------------------------
export async function handlePaiements(request: Request, s: Services): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorize(request, s, "A", "creer");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, paiementCreateSchema);
    if (body instanceof Response) return body;
    try {
      const paiement = await withTenant(s.app, auth.ctx, async (tx) => {
        const r = await createPaiement(tx, auth.ctx.organisationId, body);
        await recordAudit(tx, auth.ctx.organisationId, {
          utilisateurId: auth.session.utilisateurId,
          action: "paiement.create",
          objetType: "Paiement",
          objetId: r.id,
          resume: `${r.montantCentimes} centimes`,
        });
        return r;
      });
      return json(201, { paiement });
    } catch (e) {
      return mapError(e);
    }
  }
  const auth = await authorize(request, s, "A", "lire");
  if (auth instanceof Response) return auth;
  const paiements = await withTenant(s.app, auth.ctx, (tx) =>
    listPaiements(tx, auth.ctx.organisationId, { contratId: contratParam(request) }),
  );
  return json(200, { paiements });
}

export async function handlePaiement(request: Request, s: Services, id: string): Promise<Response> {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  if (request.method === "DELETE") {
    const auth = await authorize(request, s, "A", "modifier");
    if (auth instanceof Response) return auth;
    const ok = await withTenant(s.app, auth.ctx, (tx) =>
      archivePaiement(tx, auth.ctx.organisationId, id),
    );
    return ok ? json(200, { archive: true }) : json(404, { error: "Introuvable." });
  }
  return json(405, { error: "Méthode non autorisée." });
}

// --- Imputations ------------------------------------------------------------
export async function handleImputations(request: Request, s: Services): Promise<Response> {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  if (request.method !== "POST") return json(405, { error: "Méthode non autorisée." });
  const auth = await authorize(request, s, "A", "creer");
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, imputationCreateSchema);
  if (body instanceof Response) return body;
  try {
    const imputation = await withTenant(s.app, auth.ctx, async (tx) => {
      const r = await createImputation(tx, auth.ctx.organisationId, body);
      await recordAudit(tx, auth.ctx.organisationId, {
        utilisateurId: auth.session.utilisateurId,
        action: "imputation.create",
        objetType: "Imputation",
        objetId: r.id,
        resume: `${r.montantCentimes} centimes`,
      });
      return r;
    });
    return json(201, { imputation });
  } catch (e) {
    return mapError(e);
  }
}

export async function handleImputation(
  request: Request,
  s: Services,
  id: string,
): Promise<Response> {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  if (request.method !== "DELETE") return json(405, { error: "Méthode non autorisée." });
  const auth = await authorize(request, s, "A", "modifier");
  if (auth instanceof Response) return auth;
  const ok = await withTenant(s.app, auth.ctx, (tx) =>
    deleteImputation(tx, auth.ctx.organisationId, id),
  );
  return ok ? json(200, { supprime: true }) : json(404, { error: "Introuvable." });
}

// --- Recouvrement -----------------------------------------------------------
export async function handleImpayes(request: Request, s: Services): Promise<Response> {
  const auth = await authorize(request, s, "A", "lire");
  if (auth instanceof Response) return auth;
  const impayes = await withTenant(s.app, auth.ctx, (tx) =>
    listImpayes(tx, auth.ctx.organisationId),
  );
  return json(200, { impayes });
}

export async function handleActionsRecouvrement(request: Request, s: Services): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorize(request, s, "A", "creer");
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, actionRecouvrementCreateSchema);
    if (body instanceof Response) return body;
    try {
      const action = await withTenant(s.app, auth.ctx, (tx) =>
        createActionRecouvrement(tx, auth.ctx.organisationId, body),
      );
      return json(201, { action });
    } catch (e) {
      return mapError(e);
    }
  }
  const auth = await authorize(request, s, "A", "lire");
  if (auth instanceof Response) return auth;
  const actions = await withTenant(s.app, auth.ctx, (tx) =>
    listActionsRecouvrement(tx, auth.ctx.organisationId, contratParam(request)),
  );
  return json(200, { actions });
}
