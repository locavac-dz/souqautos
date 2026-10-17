// Portail PUBLIC de dépôt de réclamation (déclarant non authentifié).
//
// Sécurité :
//  - PAS de session : l'organisme ciblé est fourni par le déclarant (code OPGI
//    en mode partagé, ou unique organisme en mode dédié) puis VALIDÉ côté serveur
//    (organisation active) avant toute écriture ; la RLS via `withTenant` confine
//    l'insertion à ce seul organisme.
//  - Aucune lecture : l'endpoint ne renvoie QUE la référence d'accusé de réception
//    (aucune donnée d'un autre organisme ni d'autres réclamations n'est exposée).
//  - CSRF d'origine + limiteur de débit anti-abus (défense en profondeur).
import { z } from "zod";
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import { creerReclamationPublique } from "@/lib/modules/c/service";
import { recordAudit } from "@/lib/audit";

const CATEGORIES = [
  "PLOMBERIE",
  "ELECTRICITE",
  "MACONNERIE",
  "ASCENSEUR",
  "CHAUFFAGE",
  "PROPRETE",
  "AUTRE",
] as const;

const publicSchema = z.object({
  // Code de l'OPGI — requis en mode partagé, ignoré en mode dédié.
  code: z.string().trim().min(1).max(64).optional(),
  categorie: z.enum(CATEGORIES),
  description: z.string().trim().min(5).max(5000),
  declarantNom: z.string().trim().max(200).optional(),
  declarantContact: z.string().trim().max(200).optional(),
  localisation: z.string().trim().max(500).optional(),
});

function cleDebit(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0]!.trim() : "") || request.headers.get("x-real-ip") || "inconnu";
}

// POST /api/portail/reclamations — dépôt public, renvoie un accusé (référence).
export async function handleDepotPublic(request: Request, s: Services): Promise<Response> {
  if (request.method !== "POST") return json(405, { error: "Méthode non autorisée." });

  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  if (!s.publicRateLimit.check(cleDebit(request))) {
    return json(429, { error: "Trop de demandes. Réessayez plus tard." });
  }

  const body = await parseBody(request, publicSchema);
  if (body instanceof Response) return body;

  // Résolution + validation de l'organisme ciblé.
  let organisationId: string;
  if (s.config.mode === "dedicated") {
    if (!s.config.organisationId) return json(400, { error: "Portail indisponible." });
    organisationId = s.config.organisationId;
  } else {
    if (!body.code) return json(400, { error: "Code de l'OPGI requis." });
    const org = await s.admin.organisation.findUnique({ where: { code: body.code } });
    if (!org || !org.actif) return json(404, { error: "Organisme introuvable pour ce code." });
    organisationId = org.id;
  }

  try {
    const ref = await withTenant(
      s.app,
      { organisationId, mode: s.config.mode },
      async (tx) => {
        const r = await creerReclamationPublique(tx, organisationId, {
          categorie: body.categorie,
          description: body.description,
          declarantNom: body.declarantNom ?? null,
          declarantContact: body.declarantContact ?? null,
          localisation: body.localisation ?? null,
        });
        await recordAudit(tx, organisationId, {
          utilisateurId: null, // dépôt public, aucun compte
          action: "reclamation.publique.create",
          objetType: "Reclamation",
          objetId: r.id,
          resume: r.reference,
        });
        return r.reference;
      },
    );
    // Accusé de réception : UNIQUEMENT la référence (aucune autre donnée).
    return json(201, { reference: ref });
  } catch (e) {
    return mapError(e);
  }
}
