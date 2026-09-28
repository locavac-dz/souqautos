const FR_DZ = "fr-DZ";
const AR_DZ = "ar-DZ";

function dzLocale(locale: string) {
  return locale === "ar" ? AR_DZ : FR_DZ;
}

export function formatNumber(n: number, locale: string): string {
  return n.toLocaleString(dzLocale(locale));
}

export function formatPrice(n: number, locale: string): string {
  return `${n.toLocaleString(dzLocale(locale))} DA`;
}
