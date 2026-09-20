// Lot 139 — « contient, sans tenir compte de la casse » EXACTEMENT comme PostgreSQL le fait pour `ILIKE '%mot%'`, appliqué en mémoire aux
// noms de marques, de modèles et de wilayas (src/lib/search-query.ts).
//
// Pourquoi reproduire aussi les jokers : Prisma envoie le mot cherché TEL QUEL dans le motif (`%mot%`), sans protéger les caractères
// spéciaux (vérifié sur la base : « % » et « _ » trouvent tout, « c_io » trouve « Clio », « \ » protège le caractère suivant).
// Ce comportement existe depuis toujours ; le conserver garde la recherche rapide identique à l'ancienne, cas limites compris.
//
// Pourquoi PAS d'expression régulière : un motif de cent caractères mêlant beaucoup de « % » provoquerait, sur un nom de trente lettres,
// un retour arrière exponentiel — n'importe quel visiteur pourrait figer le serveur avec une adresse. L'algorithme ci-dessous (deux
// pointeurs, retour au dernier « % ») coûte au plus (longueur du texte × longueur du motif), toujours.
// Module pur : testé dans tests/like.test.ts, et contre PostgreSQL dans tests/search-equivalence.test.ts.

type Token = { kind: "any" } | { kind: "one" } | { kind: "char"; char: string };

// Le motif de LIKE : `%` = n'importe quelle suite (même vide), `_` = un caractère, `\` fait de l'octet suivant un caractère ordinaire.
function parse(pattern: string): Token[] {
  const tokens: Token[] = [];
  const chars = Array.from(pattern.toLowerCase());
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === "\\") {
      i += 1;
      tokens.push({ kind: "char", char: chars[i] ?? "\\" }); // un « \ » final : PostgreSQL refuse le motif ; ici un « \ » ordinaire
    } else if (c === "%") {
      if (tokens[tokens.length - 1]?.kind !== "any") tokens.push({ kind: "any" }); // « %% » = « % »
    } else if (c === "_") tokens.push({ kind: "one" });
    else tokens.push({ kind: "char", char: c });
  }
  return tokens;
}

// `text` correspond-il EN ENTIER au motif ? (comme LIKE : les jokers d'extrémité font le « contient »).
export function matchesLike(text: string, pattern: string): boolean {
  const tokens = parse(pattern);
  const chars = Array.from(text.toLowerCase());
  let t = 0;
  let p = 0;
  let star = -1;
  let mark = 0;
  while (t < chars.length) {
    const token = tokens[p];
    if (token?.kind === "any") {
      star = p++;
      mark = t;
    } else if (token && (token.kind === "one" || token.char === chars[t])) {
      p += 1;
      t += 1;
    } else if (star >= 0) {
      p = star + 1;
      t = ++mark;
    } else return false;
  }
  while (tokens[p]?.kind === "any") p += 1;
  return p === tokens.length;
}

// Le « contient » de Prisma (`contains` + `mode: "insensitive"`) : `ILIKE '%mot%'`.
export const containsInsensitive = (text: string, word: string): boolean => matchesLike(text, `%${word}%`);
