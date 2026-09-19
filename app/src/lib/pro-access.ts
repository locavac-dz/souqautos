import type { ProfessionalAccount } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseProPermissions, type ProPermissions } from "@/lib/pro-permissions";
import type { ProAccess } from "@/lib/pro-account";

// Lot 122 — retrouve le compte professionnel auquel une personne a accès : le sien (propriétaire) ou
// celui où elle est collaboratrice. Même règle que le tableau de bord pro, en un seul endroit pour
// les pages qui s'y ajoutent (statistiques, prospects).
export type ResolvedProAccess = { account: ProfessionalAccount; access: ProAccess };

export async function resolveProAccess(user: { id: string; professionalAccount: ProfessionalAccount | null }): Promise<ResolvedProAccess | null> {
  if (user.professionalAccount) {
    return { account: user.professionalAccount, access: { isOwner: true, permissions: null } };
  }
  const collaboration = await prisma.proCollaborator.findFirst({
    where: { userId: user.id },
    include: { professionalAccount: true },
  });
  if (!collaboration) return null;
  const permissions: ProPermissions = parseProPermissions(collaboration.permissions);
  return { account: collaboration.professionalAccount, access: { isOwner: false, permissions } };
}
