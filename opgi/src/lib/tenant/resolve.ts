// Résolution de l'organisme actif à partir de la session vérifiée.
//
// C'est le point unique où l'`organisationId` effectif est décidé. Toute la
// couche d'accès aux données en dépend. Aucun chemin n'autorise un organisme
// « demandé » par le client à élargir le périmètre de la session.

import {
  type IsolationConfig,
  type TenantContext,
  type VerifiedSession,
  TenantResolutionError,
} from "@/lib/tenant/context";

/**
 * Détermine l'organisme effectif d'une requête.
 *
 * @param session  Session vérifiée côté serveur (seule source de vérité).
 * @param config   Configuration d'isolation de l'instance.
 * @param clientHint  Valeur éventuellement fournie par le client (en-tête,
 *   paramètre…). Elle n'est JAMAIS utilisée pour choisir l'organisme ; elle
 *   sert uniquement à détecter — et refuser — une tentative d'accès croisé.
 */
export function resolveTenant(
  session: VerifiedSession,
  config: IsolationConfig,
  clientHint?: string | null,
): TenantContext {
  if (!session.organisationId) {
    throw new TenantResolutionError(
      "Session sans organisme : accès refusé (jamais d'organisme déduit du client).",
    );
  }

  // Un indice client qui diffère de la session est une tentative d'accès
  // croisé : on refuse plutôt que d'ignorer silencieusement.
  if (clientHint != null && clientHint !== session.organisationId) {
    throw new TenantResolutionError(
      "Organisme demandé différent de celui de la session : accès croisé refusé.",
    );
  }

  if (config.mode === "dedicated") {
    // Instance mono‑organisme : la session doit appartenir à CET organisme.
    if (session.organisationId !== config.organisationId) {
      throw new TenantResolutionError(
        "Session d'un autre organisme sur une instance dédiée : accès refusé.",
      );
    }
    return { organisationId: config.organisationId, mode: "dedicated" };
  }

  // Mode partagé : l'organisme est celui de la session, un point c'est tout.
  return { organisationId: session.organisationId, mode: "shared" };
}
