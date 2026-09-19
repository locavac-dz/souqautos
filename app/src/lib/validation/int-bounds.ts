// PostgreSQL n'a que des entiers 32 bits pour `Int` : une valeur supérieure,
// envoyée dans un filtre ou un identifiant, fait lever une erreur à Prisma (500).
// SQLite, entiers 64 bits, la tolérait. Toute valeur entière qui vient de
// l'utilisateur et finit dans une requête doit rester sous cette borne.
export const INT4_MAX = 2_147_483_647;

// Identifiant numérique venu d'un segment d'adresse (/api/admin/brands/[id]…).
// `Number(id)` acceptait tout : « abc » et « 99999999999 » faisaient lever une
// erreur à Prisma (500), et « 1.5 » était arrondi par la base — une requête sur
// « 1.5 » modifiait réellement la ligne 1. Seuls les entiers positifs écrits en
// chiffres, sans zéro de tête, et tenant sur 32 bits sont acceptés ; le reste se
// comporte comme un identifiant inexistant (404).
export function parsePositiveIntId(value: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(value)) return null;
  const id = Number(value);
  return id <= INT4_MAX ? id : null;
}
