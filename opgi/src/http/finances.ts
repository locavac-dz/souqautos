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
import { documentPdf } from "@/lib/pdf/simple";
import {
  createAppel,
  genererAppels,
  etatDeCompte,
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

// --- État de compte d'un contrat -------------------------------------------
export async function handleEtatCompte(request: Request, s: Services, contratId: string): Promise<Response> {
  if (request.method !== "GET") return json(405, { error: "Méthode non autorisée." });
  const auth = await authorize(request, s, "A", "lire");
  if (auth instanceof Response) return auth;
  const etat = await withTenant(s.app, auth.ctx, (tx) =>
    etatDeCompte(tx, auth.ctx.organisationId, contratId),
  );
  return etat ? json(200, { etat }) : json(404, { error: "Introuvable." });
}

function dzd(centimes: number): string {
  return (centimes / 100).toLocaleString("fr-DZ", { minimumFractionDigits: 2 });
}

export async function handleEtatComptePdf(request: Request, s: Services, contratId: string): Promise<Response> {
  if (request.method !== "GET") return json(405, { error: "Méthode non autorisée." });
  const auth = await authorize(request, s, "A", "lire");
  if (auth instanceof Response) return auth;
  const etat = await withTenant(s.app, auth.ctx, (tx) =>
    etatDeCompte(tx, auth.ctx.organisationId, contratId),
  );
  if (!etat) return json(404, { error: "Introuvable." });

  const pdf = documentPdf({
    titre: `État de compte — contrat ${etat.contrat.reference}`,
    sousTitre: `Édité le ${new Date().toISOString().slice(0, 10)} — document de données (à valider)`,
    lignes: [
      { label: "Contrat", valeur: etat.contrat.reference },
      { label: "Statut", valeur: etat.contrat.statut },
      { label: "Bien", valeur: etat.contrat.bienCode },
      { label: "Occupant", valeur: etat.contrat.occupantNom },
      {
        label: "Loyer (DZD)",
        valeur: etat.contrat.montantLoyerCentimes == null ? "—" : dzd(etat.contrat.montantLoyerCentimes),
      },
      { label: "Nombre d'appels", valeur: String(etat.nbAppels) },
      { label: "Nombre de paiements", valeur: String(etat.nbPaiements) },
      { label: "Total appelé (DZD)", valeur: dzd(etat.totalAppeleCentimes) },
      { label: "Total imputé (DZD)", valeur: dzd(etat.totalImputeCentimes) },
      { label: "Solde dû (DZD)", valeur: dzd(etat.soldeDuCentimes) },
      { label: "Total paiements (DZD)", valeur: dzd(etat.totalPaiementsCentimes) },
      { label: "Avance non imputée (DZD)", valeur: dzd(etat.avanceCentimes) },
    ],
    pied: "Plateforme OPGI — état de compte non contractuel ; aucun calcul de pénalité ni d'intérêt.",
  });

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="etat-compte-${etat.contrat.reference}.pdf"`,
    },
  });
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
