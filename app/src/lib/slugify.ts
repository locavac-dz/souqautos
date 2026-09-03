const COMBINING_DIACRITICS = new RegExp(
  String.fromCharCode(0x5b) + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + String.fromCharCode(0x5d),
  "g"
);

// Même logique que prisma/catalogue-data.ts (utilisée par le script de seed) —
// dupliquée volontairement plutôt que partagée : le script de seed tourne hors
// du bundle Next (ts-node/tsx), un import depuis src/ n'y résout pas forcément
// les mêmes alias de chemin. Deux copies d'une fonction pure de 5 lignes est
// un compromis raisonnable face au risque de casser le seed existant.
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
