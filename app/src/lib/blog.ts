// Lot 76 — génération d'un slug d'article unique à partir du titre français.
// Fonction pure testée séparément de la vérification d'unicité en base (qui,
// elle, dépend de Prisma) — même découpage que les autres slugs du projet.
export function generateUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  const existing = new Set(existingSlugs);
  if (!existing.has(baseSlug)) return baseSlug;

  let suffix = 2;
  while (existing.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseSlug}-${suffix}`;
}

// Slugs qu'aucun article ni essai ne peut prendre : ils désignent des pages
// fixes de la rubrique Essais (`/essais/revue-de-presse`, Lot 114) qui seraient
// sinon masquées par la page de l'article.
export const RESERVED_SLUGS = ["revue-de-presse"];

// Lot 126 — adresse publique d'un article selon son type (sans la langue) : le magazine, les essais et
// les guides d'achat partagent le même espace de slugs mais vivent dans trois rubriques.
export function articlePublicPath(kind: "ARTICLE" | "ESSAI" | "GUIDE", slug: string): string {
  const section = kind === "ESSAI" ? "essais" : kind === "GUIDE" ? "guides" : "mag";
  return `/${section}/${slug}`;
}

// Rubrique d'administration où s'édite un article de ce type.
export function articleAdminSection(kind: "ARTICLE" | "ESSAI" | "GUIDE"): "mag" | "essais" | "guides" {
  return kind === "ESSAI" ? "essais" : kind === "GUIDE" ? "guides" : "mag";
}
