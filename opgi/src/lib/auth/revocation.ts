// Vérification de révocation de session.
//
// Chaque jeton porte un « epoch ». Une session est révoquée si le compte est
// désactivé, absent, ou si l'epoch stocké en base a été incrémenté depuis
// l'émission du jeton (déconnexion globale, changement de mot de passe).
//
// Lecture PRIVILÉGIÉE d'un seul champ par identifiant (rôle propriétaire) : le
// contrôle a lieu AVANT que l'organisme ne soit fixé par la session, donc le
// rôle applicatif restreint ne verrait rien (même exception maîtrisée que le
// bootstrap d'authentification).
import type { PrismaClient } from "@prisma/client";
import type { VerifiedSession } from "@/lib/tenant/context";

export async function sessionRevoquee(
  session: VerifiedSession,
  adminPrisma: PrismaClient,
): Promise<boolean> {
  const user = await adminPrisma.utilisateur.findUnique({
    where: { id: session.utilisateurId },
    select: { actif: true, sessionEpoch: true },
  });
  if (!user || !user.actif) return true;
  return user.sessionEpoch !== (session.epoch ?? 0);
}
