// Configuration next-intl (sans routage par URL pour l'instant).
// FR par défaut ; l'architecture permet d'ajouter l'arabe (AR/RTL) en Phase 7
// en externalisant les messages (messages/<locale>.json) et en basculant `dir`.
import { getRequestConfig } from "next-intl/server";

export const DEFAULT_LOCALE = "fr";

export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages };
});
