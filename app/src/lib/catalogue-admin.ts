// Comblement du plus vieux écart encore ouvert (Lot 7) : jusqu'ici, les
// marques/modèles n'existaient qu'à travers le script de seed
// (prisma/seed.ts) — aucune route ne permettait à un administrateur d'en
// ajouter, renommer ou supprimer sans redéployer.
export type CatalogueNameValidation =
  | { ok: true }
  | { ok: false; error: "name_required" | "name_too_long" };

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 60;

export function validateCatalogueName(name: string): CatalogueNameValidation {
  const trimmed = name.trim();
  if (trimmed.length < MIN_NAME_LENGTH) {
    return { ok: false, error: "name_required" };
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { ok: false, error: "name_too_long" };
  }
  return { ok: true };
}
