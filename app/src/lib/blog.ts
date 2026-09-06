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
