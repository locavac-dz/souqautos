// Administration des comptes utilisateurs d'un organisme (rôle ADMIN_OPGI).
// Toutes les fonctions s'exécutent DANS une transaction `withTenant` (rôle
// restreint `opgi_app` + RLS) : un administrateur n'agit QUE sur les comptes de
// SON organisme. Les mots de passe ne sont jamais renvoyés.
import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/modules/a/service";
import { RegleMetierError } from "@/lib/modules/a/service";
import { hashPassword } from "@/lib/auth/password";
import type { UtilisateurCreate, UtilisateurUpdate } from "@/lib/auth/admin-schemas";

/** Projection publique d'un compte (jamais le hash du mot de passe). */
export interface CompteVue {
  id: string;
  email: string;
  role: string;
  perimetre: string | null;
  actif: boolean;
  deuxFacteurs: boolean;
  verrouille: boolean;
  createdAt: Date;
}

function vue(u: {
  id: string;
  email: string;
  role: string;
  perimetre: string | null;
  actif: boolean;
  totpActiveLe: Date | null;
  verrouilleJusqua: Date | null;
  createdAt: Date;
}, maintenant: Date): CompteVue {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    perimetre: u.perimetre,
    actif: u.actif,
    deuxFacteurs: u.totpActiveLe != null,
    verrouille: u.verrouilleJusqua != null && u.verrouilleJusqua > maintenant,
    createdAt: u.createdAt,
  };
}

const SELECT = {
  id: true,
  email: true,
  role: true,
  perimetre: true,
  actif: true,
  totpActiveLe: true,
  verrouilleJusqua: true,
  createdAt: true,
} as const;

export async function listComptes(
  tx: Tx,
  organisationId: string,
  maintenant: Date = new Date(),
): Promise<CompteVue[]> {
  const rows = await tx.utilisateur.findMany({
    where: { organisationId },
    orderBy: { email: "asc" },
    select: SELECT,
  });
  return rows.map((u) => vue(u, maintenant));
}

export async function creerCompte(
  tx: Tx,
  organisationId: string,
  input: UtilisateurCreate,
): Promise<CompteVue> {
  const passwordHash = await hashPassword(input.password);
  const u = await tx.utilisateur.create({
    data: {
      organisationId,
      email: input.email,
      role: input.role,
      perimetre: input.perimetre ?? null,
      passwordHash,
    },
    select: SELECT,
  });
  return vue(u, new Date());
}

/**
 * Met à jour rôle / activation / périmètre d'un compte du même organisme.
 * Désactiver un compte ou changer son rôle **révoque ses sessions** (epoch++)
 * pour que les jetons portant l'ancien rôle ou un accès révoqué cessent d'être
 * valides. Un administrateur ne peut ni se désactiver ni changer son propre
 * rôle (garde anti‑auto‑verrouillage).
 */
export async function modifierCompte(
  tx: Tx,
  organisationId: string,
  acteurId: string,
  id: string,
  input: UtilisateurUpdate,
): Promise<CompteVue | null> {
  const actuel = await tx.utilisateur.findFirst({
    where: { id, organisationId },
    select: { role: true, actif: true, sessionEpoch: true },
  });
  if (!actuel) return null;

  const desactivation = input.actif === false && actuel.actif;
  const changementRole = input.role != null && input.role !== actuel.role;

  if (id === acteurId && (desactivation || changementRole)) {
    throw new RegleMetierError("Un administrateur ne peut pas se désactiver ni changer son propre rôle.");
  }

  const data: Prisma.UtilisateurUpdateManyMutationInput = {};
  if (input.role != null) data.role = input.role;
  if (input.actif != null) data.actif = input.actif;
  if (input.perimetre !== undefined) data.perimetre = input.perimetre ?? null;
  // Révoque les sessions si désactivation ou changement de rôle.
  if (desactivation || changementRole) data.sessionEpoch = actuel.sessionEpoch + 1;

  const res = await tx.utilisateur.updateMany({ where: { id, organisationId }, data });
  if (res.count === 0) return null;
  const u = await tx.utilisateur.findFirst({ where: { id, organisationId }, select: SELECT });
  return u ? vue(u, new Date()) : null;
}

/** Réinitialise le mot de passe d'un compte et révoque ses sessions. */
export async function reinitialiserMotDePasse(
  tx: Tx,
  organisationId: string,
  id: string,
  nouveau: string,
): Promise<boolean> {
  const passwordHash = await hashPassword(nouveau);
  const res = await tx.utilisateur.updateMany({
    where: { id, organisationId },
    data: { passwordHash, echecsConnexion: 0, verrouilleJusqua: null, sessionEpoch: { increment: 1 } },
  });
  return res.count > 0;
}
