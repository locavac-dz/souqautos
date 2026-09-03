// Module volontairement sans directive "use client" : importé à la fois par le
// contexte client (CompareContext) et par la route API /api/listings/compare.
// Ne JAMAIS importer un module "use client" depuis du code serveur (Route
// Handler, Server Component) — même pour une simple constante, ça a cassé le
// rechargement à chaud de la route en développement (Turbopack), de façon
// silencieuse : la route continuait à servir une réponse figée sans erreur.
export const MAX_COMPARE = 4;

export function toggleCompareId(ids: string[], id: string, max: number = MAX_COMPARE): string[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  if (ids.length >= max) return ids;
  return [...ids, id];
}
