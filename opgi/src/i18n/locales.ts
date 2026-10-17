// Locales supportées et utilitaires i18n (purs, donc testables).
// FR par défaut ; AR active le RTL. La résolution se fait par cookie `NEXT_LOCALE`.
export const LOCALES = ["fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const COOKIE_LOCALE = "NEXT_LOCALE";

export function estLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Résout une valeur (cookie) vers une locale supportée, sinon la locale par défaut. */
export function resoudreLocale(v?: string | null): Locale {
  return estLocale(v) ? v : DEFAULT_LOCALE;
}

/** Direction d'écriture pour l'attribut `dir`. */
export function direction(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

type Arbre = { [k: string]: string | Arbre };

/**
 * Fusionne une surcouche de traduction sur une base : toute clé absente de la
 * surcouche conserve la valeur de base (repli FR). Ne mute aucun argument.
 */
export function fusionner(base: Arbre, surcouche: Arbre): Arbre {
  const out: Arbre = { ...base };
  for (const [k, v] of Object.entries(surcouche)) {
    const b = out[k];
    if (v && typeof v === "object" && b && typeof b === "object") {
      out[k] = fusionner(b, v);
    } else if (typeof v === "string") {
      out[k] = v;
    }
  }
  return out;
}
