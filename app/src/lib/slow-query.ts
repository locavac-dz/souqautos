// Lot 137 — journal des requêtes SQL lentes (src/lib/prisma.ts), activé par SLOW_QUERY_MS.
//
// Sans lui, on sait qu'une page est lente mais pas POURQUOI : la base ou le rendu ? quelle requête ? Avec SLOW_QUERY_MS=200,
// toute requête qui dure 200 ms ou plus est écrite dans les journaux (`[sql-lent] 412 ms — SELECT …`). Désactivé par défaut
// (aucun coût). Le texte SQL contient des noms de tables et de colonnes, jamais les VALEURS des paramètres (une adresse e-mail,
// un numéro de téléphone passés à la requête ne sont donc jamais écrits).
// Module pur : testé dans tests/slow-query.test.ts.

export const SLOW_QUERY_MAX_MS = 60_000;
const SQL_MAX_CHARS = 400;

// Entier de millisecondes strictement positif ; toute autre valeur (absente, vide, 0, texte, négatif) = désactivé.
export function parseSlowQueryMs(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  return value > 0 ? Math.min(value, SLOW_QUERY_MAX_MS) : null;
}

// Une seule ligne, sans le préfixe de schéma répété partout, tronquée : les requêtes de Prisma listent chaque colonne.
export function formatSlowQuery(sql: string, durationMs: number): string {
  const compact = sql.replace(/"public"\./g, "").replace(/\s+/g, " ").trim();
  const shown = compact.length > SQL_MAX_CHARS ? `${compact.slice(0, SQL_MAX_CHARS)}… (+${compact.length - SQL_MAX_CHARS} caractères)` : compact;
  return `[sql-lent] ${Math.round(durationMs)} ms — ${shown}`;
}
