import { prisma } from "@/lib/prisma";
import { canManageProListings } from "@/lib/pro-account";
import { parseProPermissions } from "@/lib/pro-permissions";

// Lot 43 — comble l'écart signalé au Lot 41 : un collaborateur d'un compte
// professionnel n'avait jusqu'ici aucun moyen d'agir sur les annonces de ce
// compte (elles appartiennent toujours à sellerId = ProfessionalAccount.userId,
// jamais au collaborateur lui-même). Un collaborateur avec la permission
// gererAnnonces (Lot 41/42) peut désormais agir exactement comme le vendeur
// réel ; un collaborateur LECTURE_SEULE (gererAnnonces=false) ou un tiers
// sans lien avec ce compte ne le peut jamais.
export async function canManageListing(userId: string, sellerId: string): Promise<boolean> {
  if (sellerId === userId) return true;

  const collaboration = await prisma.proCollaborator.findFirst({
    where: { userId, professionalAccount: { userId: sellerId } },
  });

  return canManageProListings({
    isOwner: false,
    permissions: collaboration ? parseProPermissions(collaboration.permissions) : null,
  });
}
