import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth-server/password";
import { sendEmail } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";
import {
  buildResetLink,
  createResetToken,
  hashResetToken,
  isPlausibleResetToken,
  normalizeResetLocale,
  passwordChangedEmail,
  resetEmail,
} from "@/lib/password-reset";

// Lot 133 — « mot de passe oublié » : les deux étapes, séparées des routes pour être testées sans réseau.

// Étape 1. Ne dit RIEN de l'existence du compte (ni à l'appelant, ni par un message d'erreur) : la route répond toujours
// la même chose ; c'est ici, après la réponse, qu'on cherche le compte et qu'on envoie — ou non — le courriel.
// Un compte supprimé ou suspendu n'en reçoit pas. Une nouvelle demande remplace le lien précédent.
export async function requestPasswordReset(email: string): Promise<{ sent: boolean }> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, locale: true, suspendedAt: true, deletedAt: true } });
  if (!user || user.deletedAt || user.suspendedAt) return { sent: false };

  const { token, tokenHash, expiresAt } = createResetToken();
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } }),
  ]);

  const locale = normalizeResetLocale(user.locale);
  await sendEmail({ to: user.email, ...resetEmail(locale, buildResetLink(SITE_URL, locale, token)) });
  return { sent: true };
}

export type ConfirmResult = { ok: true } | { ok: false; error: "invalid_token" };

// Un jeton inconnu, expiré, déjà utilisé, mal formé ou appartenant à un compte supprimé : UNE seule réponse.
export async function isResetTokenUsable(token: unknown, now: Date = new Date()): Promise<boolean> {
  if (!isPlausibleResetToken(token)) return false;
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) }, select: { expiresAt: true, user: { select: { deletedAt: true } } } });
  return Boolean(row && row.expiresAt.getTime() > now.getTime() && !row.user.deletedAt);
}

// Étape 2. Effets, tous ensemble ou aucun :
//  - nouveau mot de passe ; l'adresse est marquée vérifiée (la personne vient de prouver qu'elle lit ce courrier) ;
//  - verrouillage par échecs de connexion levé ;
//  - TOUTES les sessions ouvertes avant cet instant sont révoquées (un attaquant qui aurait pris le compte est éjecté) ;
//  - le jeton est consommé : à usage unique, y compris si deux demandes arrivent en même temps.
export async function confirmPasswordReset(token: unknown, password: string, now: Date = new Date()): Promise<ConfirmResult> {
  if (!isPlausibleResetToken(token)) return { ok: false, error: "invalid_token" };
  const tokenHash = hashResetToken(token);

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { userId: true, expiresAt: true, user: { select: { email: true, locale: true, emailVerifiedAt: true, deletedAt: true } } },
  });
  if (!row || row.expiresAt.getTime() <= now.getTime() || row.user.deletedAt) return { ok: false, error: "invalid_token" };

  const passwordHash = await hashPassword(password);
  const consumed = await prisma.$transaction(async (tx) => {
    // La suppression du jeton DÉCIDE : une seule des deux demandes simultanées obtient count === 1.
    const removed = await tx.passwordResetToken.deleteMany({ where: { tokenHash } });
    if (removed.count !== 1) return false;
    await tx.passwordResetToken.deleteMany({ where: { userId: row.userId } });
    await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash, emailVerifiedAt: row.user.emailVerifiedAt ?? now, failedLoginAttempts: 0, lockedUntil: null, sessionsValidAfter: now },
    });
    return true;
  });
  if (!consumed) return { ok: false, error: "invalid_token" };

  // Avertissement à la personne ; son échec ne doit pas défaire le changement.
  try {
    await sendEmail({ to: row.user.email, ...passwordChangedEmail(normalizeResetLocale(row.user.locale)) });
  } catch (error) {
    console.error(`[auth] Courriel de confirmation de changement de mot de passe non envoyé : ${(error as Error).message}`);
  }
  return { ok: true };
}
