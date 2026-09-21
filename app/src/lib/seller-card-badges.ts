import { responsivenessBadge, type Responsiveness, type ResponsivenessBadge } from "@/lib/seller-responsiveness";

// Lot 143 — les badges de confiance affichés sur une carte de résultats : identité vérifiée, et réactivité (le même badge positif que
// sur la fiche d'annonce, cf. src/lib/seller-responsiveness.ts). Pur : la carte ne décide de rien, elle affiche ce qu'on lui donne.
//
// `null` quand il n'y a rien à montrer — la carte n'ajoute alors AUCUNE ligne : un vendeur qui débute n'est jamais montré du doigt, et
// une page de résultats ordinaire ne s'alourdit pas de lignes vides.
export type CardSellerBadges = { identityVerified: boolean; responsiveness: ResponsivenessBadge | null };

export function cardSellerBadges(
  trust: { identityVerified: boolean } | undefined,
  responsiveness: Responsiveness | undefined,
): CardSellerBadges | null {
  const identityVerified = trust?.identityVerified === true;
  const badge = responsiveness ? responsivenessBadge(responsiveness) : null;
  return identityVerified || badge !== null ? { identityVerified, responsiveness: badge } : null;
}
