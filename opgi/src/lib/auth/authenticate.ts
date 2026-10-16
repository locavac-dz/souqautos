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

export const credentialsSchema = z.object({
  // Code de l'OPGI — requis en mode partagé, ignoré en mode dédié.
  code: z.string().trim().min(1).optional(),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type Credentials = z.infer<typeof credentialsSchema>;

export interface AuthDeps {
  /** Client PRIVILÉGIÉ (propriétaire) — uniquement pour ce bootstrap. */
  adminPrisma: PrismaClient;
  config: IsolationConfig;
}

/**
 * Renvoie la charge de session si les identifiants sont valides, sinon `null`.
 * Ne divulgue jamais si c'est l'organisme, l'email ou le mot de passe qui est
 * en cause.
 */
export async function authenticate(
  creds: Credentials,
  { adminPrisma, config }: AuthDeps,
): Promise<VerifiedSession | null> {
  let organisationId: string;

  if (config.mode === "dedicated") {
    if (!config.organisationId) return null;
    organisationId = config.organisationId;
  } else {
    if (!creds.code) return null;
    const org = await adminPrisma.organisation.findUnique({ where: { code: creds.code } });
    if (!org || !org.actif) return null;
    organisationId = org.id;
  }

  const user = await adminPrisma.utilisateur.findUnique({
    where: { organisationId_email: { organisationId, email: creds.email } },
  });

  // Toujours exécuter la vérification (même sans compte) pour limiter l'oracle temporel.
  const ok = await verifyPassword(creds.password, user?.passwordHash);
  if (!user || !user.actif || !ok) return null;

  return {
    utilisateurId: user.id,
    organisationId,
    role: user.role,
    perimetre: user.perimetre,
  };
}
