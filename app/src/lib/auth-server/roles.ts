import type { Role } from "@prisma/client";

// Toutes les vérifications de droits passent par ce module.
// Hiérarchie : ADMIN > MODERATEUR > SUPPORT > PROFESSIONNEL > PARTICULIER.
// SUPPORT = modération de premier niveau : annonces, signalements, avis, identité.
//           Pas d'accès : utilisateurs, statistiques, journal, paramètres, comptes pro.

export function isStaff(role: Role): boolean {
  return role === "ADMIN" || role === "MODERATEUR" || role === "SUPPORT";
}

export function isAdmin(role: Role): boolean {
  return role === "ADMIN";
}

// ADMIN + MODERATEUR : niveau d'équipe complet — exclut SUPPORT.
export function isModerator(role: Role): boolean {
  return role === "ADMIN" || role === "MODERATEUR";
}

export function isSupport(role: Role): boolean {
  return role === "SUPPORT";
}
