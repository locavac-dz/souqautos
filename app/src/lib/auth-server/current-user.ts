import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "./session";

export async function getCurrentUser() {
  const session = await getSessionFromCookies();
  if (!session) return null;

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

  return user;
}
