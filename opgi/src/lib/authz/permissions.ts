// Matrice d'autorisation : rôle × module × action.
//
// Point de départ configurable (voir docs/opgi/03-MATRICE-ROLES-PERMISSIONS.md).
// Principe du moindre privilège : tout ce qui n'est pas explicitement accordé
// est refusé. L'administrateur de plateforme (rôle technique) n'a AUCUN droit
// métier sur les modules A/B/C — séparation stricte technique ↔ métier.

export type ModuleKey = "A" | "B" | "C";
export type Action = "lire" | "creer" | "modifier" | "valider" | "exporter";

export type RoleName =
  | "ADMIN_PLATEFORME"
  | "ADMIN_OPGI"
  | "DIRECTION"
  | "AGENT_LOCATIF"
  | "AGENT_RECOUVREMENT"
  | "CHEF_PROJET"
  | "GESTIONNAIRE_MARCHES"
  | "RESP_RECLAMATIONS"
  | "TECHNICIEN"
  | "PRESTATAIRE"
  | "OCCUPANT"
  | "AUDITEUR";

type ModuleGrants = Partial<Record<ModuleKey, readonly Action[]>>;

const ALL: readonly Action[] = ["lire", "creer", "modifier", "valider", "exporter"];
const LECTURE: readonly Action[] = ["lire"];
const LECTURE_EXPORT: readonly Action[] = ["lire", "exporter"];
const GESTION: readonly Action[] = ["lire", "creer", "modifier"];

// La matrice. Un module absent = aucun droit sur ce module.
const MATRIX: Record<RoleName, ModuleGrants> = {
  // Technique uniquement : volontairement vide côté métier.
  ADMIN_PLATEFORME: {},
  ADMIN_OPGI: { A: ALL, B: ALL, C: ALL },
  DIRECTION: { A: LECTURE_EXPORT, B: LECTURE_EXPORT, C: LECTURE_EXPORT },
  AGENT_LOCATIF: { A: GESTION, C: LECTURE },
  AGENT_RECOUVREMENT: { A: [...GESTION, "exporter"], B: LECTURE },
  CHEF_PROJET: { B: GESTION, C: LECTURE },
  GESTIONNAIRE_MARCHES: { B: [...GESTION, "valider"] },
  RESP_RECLAMATIONS: { A: LECTURE, C: [...GESTION, "valider"] },
  TECHNICIEN: { C: ["lire", "modifier"] },
  PRESTATAIRE: { B: ["lire", "creer"], C: ["lire", "modifier"] },
  OCCUPANT: { C: ["lire", "creer"] },
  AUDITEUR: { A: LECTURE, B: LECTURE, C: LECTURE },
};

/** Vrai si `role` peut faire `action` dans `module`. Refus par défaut. */
export function can(role: RoleName, module: ModuleKey, action: Action): boolean {
  return MATRIX[role]?.[module]?.includes(action) ?? false;
}

export class AuthorizationError extends Error {
  constructor(role: RoleName, module: ModuleKey, action: Action) {
    super(`Rôle ${role} non autorisé à « ${action} » sur le module ${module}.`);
    this.name = "AuthorizationError";
  }
}

/** Lève `AuthorizationError` si l'action n'est pas permise. */
export function assertCan(role: RoleName, module: ModuleKey, action: Action): void {
  if (!can(role, module, action)) throw new AuthorizationError(role, module, action);
}

/** Expose la matrice (lecture seule) pour documentation/tests. */
export function permissionMatrix(): Readonly<Record<RoleName, ModuleGrants>> {
  return MATRIX;
}
