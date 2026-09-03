import { prisma } from "@/lib/prisma";

export type ProfessionalBadgeInfo = {
  nomCommercial: string;
  badgeVerifie: boolean;
};

// Comblement du plus vieux écart encore ouvert (Lot 13) : aucun badge ne
// distinguait un vendeur professionnel sur les cartes de résultats — le
// compte pro (Lot 13) et son badge vérifié (back-office, même lot) existaient
// sans jamais être montrés ailleurs que sur la vitrine /pro/[id] elle-même.
// Une seule requête `IN`, pas de N+1 : pas besoin du dédoublonnage manuel de
// getSellerTrustSummariesForSellers (Lot 28), Prisma le fait nativement ici.
export async function getProfessionalBadgesForSellers(
  sellerIds: string[]
): Promise<Map<string, ProfessionalBadgeInfo>> {
  const uniqueIds = [...new Set(sellerIds)];
  if (uniqueIds.length === 0) return new Map();

  const accounts = await prisma.professionalAccount.findMany({
    where: { userId: { in: uniqueIds } },
    select: { userId: true, nomCommercial: true, badgeVerifie: true },
  });

  return new Map(accounts.map((a) => [a.userId, { nomCommercial: a.nomCommercial, badgeVerifie: a.badgeVerifie }]));
}
