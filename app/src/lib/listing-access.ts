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

// Même écart que ci-dessus, jamais corrigé pour la messagerie : un
// collaborateur avec la permission gererAnnonces ne pouvait jusqu'ici ni
// consulter ni répondre aux conversations concernant les annonces du compte
// pro qu'il gère (Conversation.sellerId reste toujours le propriétaire, comme
// Listing.sellerId). Réutilise exactement la même règle d'autorisation.
export async function canAccessConversation(
  userId: string,
  conversation: { buyerId: string; sellerId: string }
): Promise<boolean> {
  if (conversation.buyerId === userId || conversation.sellerId === userId) return true;
  return canManageListing(userId, conversation.sellerId);
}

// Identifiants "vendeur" pour lesquels cet utilisateur peut agir : le sien
// propre, plus ceux des comptes professionnels où il collabore avec la
// permission gererAnnonces — utilisé pour afficher, dans la boîte de
// réception, les conversations des annonces qu'il gère pour le compte
// d'autrui, en plus des siennes.
export async function getManageableSellerIds(userId: string): Promise<string[]> {
  const collaborations = await prisma.proCollaborator.findMany({
    where: { userId },
    include: { professionalAccount: { select: { userId: true } } },
  });

  const collaboratedSellerIds = collaborations
    .filter((c) => parseProPermissions(c.permissions).gererAnnonces)
    .map((c) => c.professionalAccount.userId);

  return [userId, ...collaboratedSellerIds];
}
