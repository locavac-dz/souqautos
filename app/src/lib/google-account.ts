import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { isStaff } from "@/lib/auth-server/roles";
import { GOOGLE_PROVIDER, type GoogleLoginLocale, type GoogleProfile } from "@/lib/google-oauth";

// Lot 132 — à quel compte du site correspond une personne qui vient de se connecter avec Google ?
//
// Règles, dans l'ordre :
//  1. Ce compte Google est déjà lié à un compte du site : c'est celui-là (l'identifiant `sub` de Google ne change
//     jamais, même si la personne change d'adresse e-mail Google).
//  2. Sinon, si une adresse identique existe déjà sur le site :
//     - compte suspendu ou compte de l'équipe (modérateur, administrateur) : REFUS. Un compte de l'équipe ne se
//       connecte jamais par un fournisseur externe : l'accès à la modération ne dépend pas d'un autre service ;
//     - adresse NON vérifiée sur le site : REFUS. Google atteste que la personne possède cette adresse, mais rien
//       n'atteste que le compte du site est le sien : n'importe qui a pu s'inscrire avec l'adresse d'un autre, avec
//       un mot de passe de son choix, avant lui. Rattacher Google à ce compte le donnerait à l'usurpateur. La
//       personne se connecte par mot de passe, vérifie son adresse, puis Google fonctionne ;
//     - adresse vérifiée : le compte Google est rattaché à ce compte.
//  3. Sinon, un compte est créé : adresse vérifiée d'office (Google l'a attestée), aucun mot de passe.
export type GoogleSignInRefusal = "suspended" | "staff" | "unverified_account" | "deleted";
export type GoogleSignInResult =
  // totpEnabledAt (Lot 138) : la connexion Google d'un compte qui a la double authentification exige encore le code.
  | { ok: true; user: { id: string; role: Role; totpEnabledAt: Date | null }; created: boolean; linked: boolean }
  | { ok: false; reason: GoogleSignInRefusal };

type AccountRow = { id: string; role: Role; suspendedAt: Date | null; deletedAt: Date | null };

function gate(user: AccountRow): GoogleSignInRefusal | null {
  if (user.deletedAt) return "deleted";
  if (user.suspendedAt) return "suspended";
  if (isStaff(user.role)) return "staff";
  return null;
}

function displayNameFor(profile: GoogleProfile): string {
  const fromEmail = profile.email.split("@")[0].slice(0, 80);
  const name = profile.name ?? fromEmail;
  return name.length >= 2 ? name : "Utilisateur";
}

export async function signInWithGoogleProfile(profile: GoogleProfile, locale: GoogleLoginLocale, attempt = 0): Promise<GoogleSignInResult> {
  const link = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: GOOGLE_PROVIDER, providerAccountId: profile.sub } },
    include: { user: { select: { id: true, role: true, suspendedAt: true, deletedAt: true, totpEnabledAt: true } } },
  });
  if (link) {
    const refusal = gate(link.user);
    return refusal ? { ok: false, reason: refusal } : { ok: true, user: { id: link.user.id, role: link.user.role, totpEnabledAt: link.user.totpEnabledAt }, created: false, linked: false };
  }

  const existing = await prisma.user.findUnique({
    where: { email: profile.email },
    select: { id: true, role: true, suspendedAt: true, deletedAt: true, emailVerifiedAt: true, totpEnabledAt: true },
  });
  if (existing) {
    const refusal = gate(existing);
    if (refusal) return { ok: false, reason: refusal };
    if (!existing.emailVerifiedAt) return { ok: false, reason: "unverified_account" };
    try {
      await prisma.oAuthAccount.create({ data: { provider: GOOGLE_PROVIDER, providerAccountId: profile.sub, userId: existing.id } });
    } catch (error) {
      // Deux retours de Google simultanés pour le même compte : l'autre a déjà écrit le lien, c'est le même résultat.
      if (!isUniqueViolation(error)) throw error;
    }
    return { ok: true, user: { id: existing.id, role: existing.role, totpEnabledAt: existing.totpEnabledAt }, created: false, linked: true };
  }

  try {
    const user = await prisma.user.create({
      data: {
        email: profile.email,
        passwordHash: null,
        emailVerifiedAt: new Date(),
        locale,
        profile: { create: { displayName: displayNameFor(profile) } },
        oauthAccounts: { create: { provider: GOOGLE_PROVIDER, providerAccountId: profile.sub } },
      },
      select: { id: true, role: true },
    });
    return { ok: true, user: { ...user, totpEnabledAt: null }, created: true, linked: false };
  } catch (error) {
    // Une inscription est survenue entre la vérification et la création : on repart de zéro, une seule fois.
    if (isUniqueViolation(error) && attempt === 0) return signInWithGoogleProfile(profile, locale, 1);
    throw error;
  }
}
