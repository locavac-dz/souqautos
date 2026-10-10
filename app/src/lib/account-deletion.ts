// Lot 51 — suppression de compte à la demande du titulaire, par anonymisation
// (jamais une suppression physique — cf. audit Lot 50, la plupart des
// relations vers User sont en RESTRICT). L'email doit rester unique en base
// (contrainte @unique) : remplacé par une adresse jamais réutilisable, dérivée
// de l'id (déterministe, pratique pour retrouver un compte anonymisé en base
// à des fins de support, sans jamais révéler l'email d'origine).
export function generateAnonymizedEmail(userId: string): string {
  return `deleted-${userId}@deleted.souqautos.com`;
}

// Un nom d'affichage est toujours du texte libre non traduit (comme un vrai
// prénom/nom), jamais une clé i18n — ce remplacement suit la même convention.
export const ANONYMIZED_DISPLAY_NAME = "Utilisateur supprimé";

// Motif appliqué aux annonces retirées de la vente au moment de la
// suppression du compte vendeur (statut SUSPENDUE réutilisé, cf. décision du
// Lot 51 — pas de nouveau statut dédié pour un cas qui n'est pas une décision
// de modération).
export const ACCOUNT_DELETED_LISTING_NOTE =
  "Annonce retirée : le compte vendeur a été supprimé.";
