import type { Metadata } from "next";

// Lot 124 — preuve de propriété du site demandée par Google Search Console et Bing Webmaster Tools.
//
// Chaque outil donne un code à publier dans une balise <meta> de la page d'accueil ; on le lit
// dans l'environnement pour ne pas figer dans le dépôt le code d'un site précis. Sans variable,
// aucune balise n'est émise. Un code n'est accepté que s'il a la forme d'un jeton (lettres,
// chiffres, tiret, souligné) : une valeur mal collée ne doit jamais injecter autre chose dans la page.
const TOKEN = /^[A-Za-z0-9_-]{10,200}$/;

type Env = Record<string, string | undefined>;

export function buildSearchEngineVerification(env: Env): Pick<Metadata, "verification"> | Record<string, never> {
  const google = env.GOOGLE_SITE_VERIFICATION?.trim();
  const bing = env.BING_SITE_VERIFICATION?.trim();
  const googleOk = google && TOKEN.test(google) ? google : undefined;
  const bingOk = bing && TOKEN.test(bing) ? bing : undefined;
  if (!googleOk && !bingOk) return {};
  return {
    verification: {
      ...(googleOk ? { google: googleOk } : {}),
      ...(bingOk ? { other: { "msvalidate.01": bingOk } } : {}),
    },
  };
}

// Pour `launch:check` : « absent », « valide » ou « invalide » (défini mais pas un jeton).
export function verificationStatus(value: string | undefined): "absent" | "valid" | "invalid" {
  const trimmed = value?.trim();
  if (!trimmed) return "absent";
  return TOKEN.test(trimmed) ? "valid" : "invalid";
}
