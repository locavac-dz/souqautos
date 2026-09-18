const META_DESCRIPTION_MAX = 160;

// La présentation d'un compte pro est un texte libre multi-lignes : on la
// ramène sur une ligne avant de la couper à 160 caractères (même longueur que
// les annonces). Renvoie undefined si elle est vide, pour laisser l'appelant
// utiliser une description de repli.
export function buildShowcaseDescription(presentation: string | null): string | undefined {
  const flat = presentation?.replace(/\s+/g, " ").trim();
  return flat ? flat.slice(0, META_DESCRIPTION_MAX) : undefined;
}

// Comme dans l'annuaire (Lot 107), une vitrine sans annonce publiée est une page
// creuse : elle reste accessible mais ne doit pas être indexée.
export function isShowcaseIndexable(publishedListingCount: number): boolean {
  return publishedListingCount > 0;
}
