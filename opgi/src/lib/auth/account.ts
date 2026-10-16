// Gestion du compte de l'utilisateur courant : changement de mot de passe.
// S'exécute DANS une transaction `withTenant` (rôle restreint `opgi_app` + RLS) :
// l'utilisateur ne peut agir que sur SA propre ligne, dans SON organisme.
import type { Tx } from "@/lib/modules/a/service";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { genererSecret, verifierCode, otpauthUri } from "@/lib/auth/totp";

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

// --- 2FA TOTP ---------------------------------------------------------------

/** Statut 2FA de l'utilisateur courant. */
export async function statutTOTP(
  tx: Tx,
  organisationId: string,
  utilisateurId: string,
): Promise<{ actif: boolean } | null> {
  const user = await tx.utilisateur.findFirst({
    where: { id: utilisateurId, organisationId },
    select: { totpActiveLe: true },
  });
  if (!user) return null;
  return { actif: user.totpActiveLe != null };
}

export type DebutTOTP =
  | { statut: "ok"; secret: string; uri: string }
  | { statut: "deja_actif" }
  | { statut: "introuvable" };

/**
 * Initie l'enrôlement : génère un secret PROVISOIRE (non activé) et renvoie le
 * secret + l'URI otpauth. L'activation requiert ensuite la preuve d'un code.
 * Refuse si la 2FA est déjà active (il faut d'abord la désactiver).
 */
export async function debuterTOTP(
  tx: Tx,
  organisationId: string,
  utilisateurId: string,
  emetteur: string,
): Promise<DebutTOTP> {
  const user = await tx.utilisateur.findFirst({ where: { id: utilisateurId, organisationId } });
  if (!user) return { statut: "introuvable" };
  if (user.totpActiveLe) return { statut: "deja_actif" };

  const secret = genererSecret();
  await tx.utilisateur.updateMany({
    where: { id: utilisateurId, organisationId },
    data: { totpSecret: secret, totpActiveLe: null },
  });
  return { statut: "ok", secret, uri: otpauthUri(secret, user.email, emetteur) };
}

export type ActivationTOTP = "ok" | "pas_de_secret" | "deja_actif" | "code_invalide" | "introuvable";

/** Active la 2FA après vérification d'un code calculé sur le secret provisoire. */
export async function activerTOTP(
  tx: Tx,
  organisationId: string,
  utilisateurId: string,
  code: string,
  now: Date = new Date(),
): Promise<ActivationTOTP> {
  const user = await tx.utilisateur.findFirst({ where: { id: utilisateurId, organisationId } });
  if (!user) return "introuvable";
  if (user.totpActiveLe) return "deja_actif";
  if (!user.totpSecret) return "pas_de_secret";
  if (!verifierCode(user.totpSecret, code, now.getTime())) return "code_invalide";
  await tx.utilisateur.updateMany({
    where: { id: utilisateurId, organisationId },
    data: { totpActiveLe: now },
  });
  return "ok";
}

export type DesactivationTOTP = "ok" | "mauvais_mot_de_passe" | "introuvable";

/** Désactive la 2FA après vérification du mot de passe (efface le secret). */
export async function desactiverTOTP(
  tx: Tx,
  organisationId: string,
  utilisateurId: string,
  motDePasse: string,
): Promise<DesactivationTOTP> {
  const user = await tx.utilisateur.findFirst({ where: { id: utilisateurId, organisationId } });
  if (!user) return "introuvable";
  if (!(await verifyPassword(motDePasse, user.passwordHash))) return "mauvais_mot_de_passe";
  await tx.utilisateur.updateMany({
    where: { id: utilisateurId, organisationId },
    data: { totpSecret: null, totpActiveLe: null },
  });
  return "ok";
}
