// Vérification des identifiants (bootstrap d'authentification).
//
// ⚠ Chemin privilégié UNIQUE : la vérification des identifiants se fait avec un
// client PRIVILÉGIÉ (rôle propriétaire, non soumis à la RLS), car au moment du
// login aucune session n'existe encore — donc aucun organisme n'est fixé, et le
// rôle applicatif restreint `opgi_app` ne verrait rien (fail‑closed). Ce chemin
// est volontairement réduit à la seule vérification des identifiants ; toute
// autre lecture passe par `opgi_app` + `withTenant`. Durcissement prévu : rôle
// d'authentification dédié (SELECT limité à organisation/utilisateur).
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import type { IsolationConfig, VerifiedSession } from "@/lib/tenant/context";
import { verifyPassword } from "@/lib/auth/password";
import { verifierCode } from "@/lib/auth/totp";

export const credentialsSchema = z.object({
  // Code de l'OPGI — requis en mode partagé, ignoré en mode dédié.
  code: z.string().trim().min(1).optional(),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  // Code 2FA (TOTP) — requis seulement si la 2FA est active sur le compte.
  code2fa: z.string().trim().optional(),
});

export type Credentials = z.infer<typeof credentialsSchema>;

/** Politique de verrouillage anti‑bruteforce (brief §9). Valeurs configurables. */
export interface LockoutPolicy {
  maxAttempts: number;
  lockMs: number;
}
export const DEFAULT_LOCKOUT: LockoutPolicy = { maxAttempts: 5, lockMs: 15 * 60 * 1000 };

export interface AuthDeps {
  /** Client PRIVILÉGIÉ (propriétaire) — uniquement pour ce bootstrap. */
  adminPrisma: PrismaClient;
  config: IsolationConfig;
  lockout?: LockoutPolicy;
}

/** Résultat d'authentification. `2fa_requis` : mot de passe correct mais la 2FA
 * exige un code à usage unique (absent ou invalide). */
export type AuthResult =
  | { statut: "ok"; session: VerifiedSession }
  | { statut: "echec" }
  | { statut: "2fa_requis" };

/**
 * Renvoie la charge de session si les identifiants sont valides, sinon un échec.
 * Ne divulgue jamais si c'est l'organisme, l'email, le mot de passe ou un
 * verrouillage qui est en cause (message générique côté handler) — à la seule
 * exception de `2fa_requis`, qui signale au client d'afficher le champ du code
 * (le mot de passe était correct) ; compromis UX assumé et documenté.
 *
 * Verrouillage : après `maxAttempts` échecs consécutifs, le compte est bloqué
 * pour `lockMs`. Une connexion réussie remet le compteur à zéro. Pendant le
 * verrouillage, même le bon mot de passe est refusé.
 */
export async function authenticate(
  creds: Credentials,
  { adminPrisma, config, lockout = DEFAULT_LOCKOUT }: AuthDeps,
): Promise<AuthResult> {
  let organisationId: string;

  if (config.mode === "dedicated") {
    if (!config.organisationId) return { statut: "echec" };
    organisationId = config.organisationId;
  } else {
    if (!creds.code) return { statut: "echec" };
    const org = await adminPrisma.organisation.findUnique({ where: { code: creds.code } });
    if (!org || !org.actif) return { statut: "echec" };
    organisationId = org.id;
  }

  const user = await adminPrisma.utilisateur.findUnique({
    where: { organisationId_email: { organisationId, email: creds.email } },
  });

  // Toujours exécuter la vérification (même sans compte) pour limiter l'oracle temporel.
  const ok = await verifyPassword(creds.password, user?.passwordHash);
  if (!user || !user.actif) return { statut: "echec" };

  const now = new Date();
  // Compte verrouillé : refus sans incrémenter davantage ni révéler la cause.
  if (user.verrouilleJusqua && user.verrouilleJusqua > now) return { statut: "echec" };

  if (!ok) {
    const echecs = user.echecsConnexion + 1;
    await adminPrisma.utilisateur.update({
      where: { id: user.id },
      data:
        echecs >= lockout.maxAttempts
          ? { echecsConnexion: echecs, verrouilleJusqua: new Date(now.getTime() + lockout.lockMs) }
          : { echecsConnexion: echecs },
    });
    return { statut: "echec" };
  }

  // Mot de passe correct : remet le compteur à zéro (et lève un verrou expiré).
  if (user.echecsConnexion !== 0 || user.verrouilleJusqua) {
    await adminPrisma.utilisateur.update({
      where: { id: user.id },
      data: { echecsConnexion: 0, verrouilleJusqua: null },
    });
  }

  // Second facteur : si la 2FA est active, exiger un code TOTP valide.
  if (user.totpActiveLe && user.totpSecret) {
    if (!creds.code2fa) return { statut: "2fa_requis" };
    if (!verifierCode(user.totpSecret, creds.code2fa, now.getTime())) return { statut: "echec" };
  }

  return {
    statut: "ok",
    session: {
      utilisateurId: user.id,
      organisationId,
      role: user.role,
      perimetre: user.perimetre,
      epoch: user.sessionEpoch,
    },
  };
}
