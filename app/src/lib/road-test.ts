// Lot 110 — helpers purs des essais auto.

export const RATING_MIN = 0.5;
export const RATING_MAX = 5;

// La note s'exprime sur 5, par demi-point (3,5 = trois étoiles et demie).
export function isValidRating(rating: number): boolean {
  return (
    Number.isFinite(rating) &&
    rating >= RATING_MIN &&
    rating <= RATING_MAX &&
    Number.isInteger(rating * 2)
  );
}

export function starsFromRating(rating: number): { full: number; half: boolean; empty: number } {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return { full, half, empty: RATING_MAX - full - (half ? 1 : 0) };
}

// Points forts / points faibles : saisis un par ligne dans le formulaire
// d'administration, stockés tels quels (même convention « liste dans une
// String » que le reste du schéma).
export const MAX_LIST_ITEMS = 8;
export const MAX_LIST_ITEM_LENGTH = 200;

export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function isValidBulletList(text: string): boolean {
  const items = splitLines(text);
  return (
    items.length >= 1 &&
    items.length <= MAX_LIST_ITEMS &&
    items.every((item) => item.length <= MAX_LIST_ITEM_LENGTH)
  );
}

// « 3,5 » en français, pas « 3.5 » : la note passe par le formatage de la langue
// avant d'être insérée dans les textes traduits (une valeur numérique brute est
// simplement convertie en chaîne).
export function formatRating(rating: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(rating);
}
