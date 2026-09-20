import type { Role } from "@prisma/client";

// Lot 138 — obligation de la double authentification pour l'ÉQUIPE (administrateurs et modérateurs).
//
// Un compte d'équipe sans double authentification n'a AUCUN pouvoir d'équipe : getCurrentUser() lui rend le rôle de simple
// particulier (src/lib/auth-server/current-user.ts). Toutes les vérifications de droits du site (isStaff, isAdmin, pages et API
// d'administration) passent par cet unique point : aucune n'est à modifier, aucune ne peut être oubliée. La personne se connecte
// normalement, va sur « Sécurité », active la fonction, et retrouve ses droits immédiatement.
//
//   REQUIRE_STAFF_2FA="1"  toujours exigée ;   "0"  jamais ;   absent : exigée EN PRODUCTION seulement (les tests et le
//   développement gardent des comptes d'équipe simples).
// Module pur : testé dans tests/staff-two-factor.test.ts.
export function staffTwoFactorRequired(env: Record<string, string | undefined>): boolean {
  if (env.REQUIRE_STAFF_2FA === "1") return true;
  if (env.REQUIRE_STAFF_2FA === "0") return false;
  return env.NODE_ENV === "production";
}

export function isStaffRole(role: Role): boolean {
  return role === "ADMIN" || role === "MODERATEUR";
}

// Le rôle EFFECTIF : celui de la base, sauf pour un compte d'équipe qui doit avoir la double authentification et ne l'a pas.
export function effectiveRole(user: { role: Role; totpEnabledAt: Date | null }, required: boolean): Role {
  return required && isStaffRole(user.role) && !user.totpEnabledAt ? "PARTICULIER" : user.role;
}
