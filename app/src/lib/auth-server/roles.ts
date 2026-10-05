import type { Role } from "@prisma/client";

// Toutes les vérifications de droits passent par ce module.
// Hiérarchie : SUPER_ADMIN > ADMIN > MODERATEUR > SUPPORT > PROFESSIONNEL > PARTICULIER.
// SUPER_ADMIN = fondateur / PDG : seul à pouvoir attribuer/révoquer le rôle SUPER_ADMIN
//              et à dégrader un ADMIN. Ne peut pas être rétrogradé par un simple ADMIN.
// ADMIN       = responsable opérationnel : gestion complète sauf attribution SUPER_ADMIN.
// SUPPORT     = modération de premier niveau : annonces, signalements, avis, identité.
//              Pas d'accès : utilisateurs, statistiques, journal, paramètres, comptes pro.

export function isSuperAdmin(role: Role): boolean {
  return role === "SUPER_ADMIN";
}

export function isStaff(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "MODERATEUR" || role === "SUPPORT";
}

// SUPER_ADMIN + ADMIN : accès complet au back-office.
export function isAdmin(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

// ADMIN + MODERATEUR (+ SUPER_ADMIN) : équipe de modération complète — exclut SUPPORT.
export function isModerator(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "MODERATEUR";
}

export function isSupport(role: Role): boolean {
  return role === "SUPPORT";
}
