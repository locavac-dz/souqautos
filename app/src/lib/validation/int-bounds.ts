// PostgreSQL n'a que des entiers 32 bits pour `Int` : une valeur supérieure,
// envoyée dans un filtre ou un identifiant, fait lever une erreur à Prisma (500).
// SQLite, entiers 64 bits, la tolérait. Toute valeur entière qui vient de
// l'utilisateur et finit dans une requête doit rester sous cette borne.
export const INT4_MAX = 2_147_483_647;
