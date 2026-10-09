import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "./session";
import { isSessionRevoked } from "./session-revocation";
import { effectiveRole, staffTwoFactorRequired } from "@/lib/staff-two-factor";

// Lot 268 (audit C6) — mémoïsé par requête avec `cache()` de React : la mise en page ET la page (et parfois
// `generateMetadata`) appellent cette fonction pour le même visiteur ; chaque appel coûtait une lecture `User`
// (avec profil et compte pro) et une consultation de la liste de révocation. Hors d'un rendu React (scripts,
// tests), `cache()` est transparent : la fonction s'exécute à chaque appel.
export const getCurrentUser = cache(async function getCurrentUser() {
  const session = await getSessionFromCookies();
  if (!session) return null;

  // Lot 229 — session révoquée par une déconnexion : refusée même si le jeton est encore valable.
  if (session.jti && (await isSessionRevoked(session.jti))) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { profile: { include: { wilaya: true } }, professionalAccount: true },
  });

  // Un compte suspendu (Lot 31) perd immédiatement toute capacité authentifiée
  // partout dans l'application — ce chokepoint unique évite de dupliquer la
  // vérification dans chaque route/page, cohérent avec le blocage à la connexion.
  if (user?.suspendedAt) return null;

  // Même principe pour un compte supprimé par son titulaire (Lot 51) — une
  // session déjà active au moment de la suppression ne doit pas rester
  // utilisable jusqu'à expiration du cookie.
  if (user?.deletedAt) return null;

  // Lot 133 — session ouverte AVANT la dernière réinitialisation du mot de passe : refusée (à la milliseconde).
  if (user?.sessionsValidAfter && session.issuedAtMs < user.sessionsValidAfter.getTime()) return null;

  // Lot 138 — un compte d'équipe SANS double authentification n'a aucun pouvoir d'équipe (rôle effectif : simple particulier)
  // quand elle est exigée (src/lib/staff-two-factor.ts). Point unique : toutes les vérifications de droits passent ici.
  if (user) {
    const role = effectiveRole(user, staffTwoFactorRequired(process.env));
    if (role !== user.role) return { ...user, role };
  }

  return user;
});
