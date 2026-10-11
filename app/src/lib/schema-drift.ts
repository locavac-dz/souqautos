// Contrôle d'écart entre les migrations et schema.prisma (CI) : analyse du SQL produit par
// `prisma migrate diff --from-migrations … --to-schema-datamodel … --script`.
//
// Les index GIN pg_trgm de la recherche par texte sont créés en SQL brut par les migrations et sont volontairement
// ABSENTS de schema.prisma : ils sont conditionnels (migration 20261008030000_restore_trgm_indexes_when_available,
// l'extension pg_trgm pouvant manquer — cf. migration 225, erreur Windows 58P01). Prisma les voit donc comme
// « à supprimer ». Ces trois instructions précises sont tolérées ; TOUT autre écart (une migration oubliée, un
// champ ajouté au schéma sans migration) reste une erreur.

export const TOLERATED_STATEMENTS: readonly RegExp[] = [
  /^DROP INDEX (IF EXISTS )?("public"\.)?"Listing_(title|brandFreeText|modelFreeText)_trgm_idx";$/,
];

// Messages d'information du CLI Prisma, susceptibles de se mêler à la sortie : jamais du SQL.
const CLI_NOISE: readonly RegExp[] = [
  /^warn\b/i,
  /^info\b/i,
  /^For more information\b/,
  /^Prisma schema loaded\b/,
  /^Datasource\b/,
  /^Environment variables loaded\b/,
];

/** Instructions du SQL d'écart qui ne sont pas tolérées (commentaires, lignes vides et bruit du CLI ignorés). */
export function unexpectedStatements(sql: string): string[] {
  return sql
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("--") && !CLI_NOISE.some((noise) => noise.test(line)))
    .filter((line) => !TOLERATED_STATEMENTS.some((allowed) => allowed.test(line)));
}
