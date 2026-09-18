import type { ProPermissions } from "@/lib/pro-permissions";

export type ProAccess = {
  isOwner: boolean;
  // null : l'utilisateur n'est pas du tout affilié à ce compte (ni
  // propriétaire, ni collaborateur) — distinct de « collaborateur sans
  // aucune permission activée », qui vaut { gererAnnonces: false, repondreAvis: false }.
  permissions: ProPermissions | null;
};

// Le tableau de bord (statistiques, annonces) reste lisible par tout
// collaborateur, quelles que soient ses permissions — seules les actions de
// gestion elles-mêmes sont restreintes par permission.
export function canViewProDashboard(access: ProAccess): boolean {
  return access.isOwner || access.permissions !== null;
}

export function canManageProListings(access: ProAccess): boolean {
  return access.isOwner || Boolean(access.permissions?.gererAnnonces);
}

export function canReplyToProReviews(access: ProAccess): boolean {
  return access.isOwner || Boolean(access.permissions?.repondreAvis);
}

// La gestion des collaborateurs (ajout/retrait/permissions) reste réservée
// au propriétaire — jamais déléguable, même à un collaborateur qui aurait
// toutes les autres permissions activées.
export function canManageCollaborators(access: ProAccess): boolean {
  return access.isOwner;
}

// Le badge « Vérifié » est posé à la main par un admin après contrôle d'une
// entreprise précise : changer de nom commercial sur un compte vérifié ne doit
// pas permettre de garder le badge sous une autre identité. Seule une vraie
// modification retire le badge — corriger la casse ou les espaces (« auto sara
// motors » → « Auto Sara Motors ») ne compte pas.
function normalizeBusinessName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function shouldRevokeVerifiedBadge(input: {
  badgeVerifie: boolean;
  currentName: string;
  nextName: string;
}): boolean {
  return input.badgeVerifie && normalizeBusinessName(input.currentName) !== normalizeBusinessName(input.nextName);
}
