// Gestion du compte de l'utilisateur courant : changement de mot de passe.
// S'exécute DANS une transaction `withTenant` (rôle restreint `opgi_app` + RLS) :
// l'utilisateur ne peut agir que sur SA propre ligne, dans SON organisme.
import type { Tx } from "@/lib/modules/a/service";
import { verifyPassword, hashPassword } from "@/lib/auth/password";

export type ChangementMdpResultat = "ok" | "mauvais_ancien" | "introuvable";

/**
 * Change le mot de passe de l'utilisateur après vérification de l'ancien.
 * Réinitialise les compteurs de verrouillage (un changement réussi lève un
 * éventuel verrou). La robustesse (longueur) est validée en amont par le
 * handler selon la politique configurable.
 */
export async function changerMotDePasse(
  tx: Tx,
  organisationId: string,
  utilisateurId: string,
  ancien: string,
  nouveau: string,
): Promise<ChangementMdpResultat> {
  const user = await tx.utilisateur.findFirst({
    where: { id: utilisateurId, organisationId },
  });
  if (!user) return "introuvable";

  const ok = await verifyPassword(ancien, user.passwordHash);
  if (!ok) return "mauvais_ancien";

  const passwordHash = await hashPassword(nouveau);
  // updateMany borné par (id, organisationId) : jamais une autre ligne.
  const res = await tx.utilisateur.updateMany({
    where: { id: utilisateurId, organisationId },
    data: { passwordHash, echecsConnexion: 0, verrouilleJusqua: null },
  });
  return res.count > 0 ? "ok" : "introuvable";
}
