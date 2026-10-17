// Configuration next-intl : locale par cookie `NEXT_LOCALE` (fr|ar), sans routage
// par URL. Les messages AR sont FUSIONNÉS sur FR : toute clé arabe manquante
// retombe sur le français (jamais de clé brute affichée). `dir` est posé par le
// layout via `direction(locale)`.
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { resoudreLocale, fusionner, COOKIE_LOCALE, DEFAULT_LOCALE } from "@/i18n/locales";
import fr from "../../messages/fr.json";

export { DEFAULT_LOCALE };

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resoudreLocale(store.get(COOKIE_LOCALE)?.value);
  if (locale === "fr") return { locale, messages: fr };
  const ar = (await import(`../../messages/${locale}.json`)).default;
  // Repli FR pour toute clé non encore traduite.
  return { locale, messages: fusionner(fr as never, ar) };
});
