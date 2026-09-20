import { getTranslations } from "next-intl/server";
import type { GoogleLoginLocale } from "@/lib/google-oauth";

// Lot 132 — « Continuer avec Google », suivi d'un séparateur « ou ». Un simple lien (pas un bouton de formulaire) :
// la connexion commence par une navigation vers /api/auth/google/start, qui renvoie vers Google.
// Le logo « G » est celui que Google demande pour ses boutons de connexion.
export async function GoogleSignInButton({ locale, next }: { locale: GoogleLoginLocale; next?: string }) {
  const t = await getTranslations("Auth");
  const href = `/api/auth/google/start?locale=${locale}${next ? `&next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="mb-6">
      <a
        href={href}
        className="flex w-full items-center justify-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
      >
        <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        {t("googleContinue")}
      </a>
      <div className="mt-6 flex items-center gap-3 text-xs uppercase text-slate-400" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" />
        {t("googleOr")}
        <span className="h-px flex-1 bg-slate-200" />
      </div>
    </div>
  );
}

// Message d'erreur renvoyé par la connexion Google (`?erreur=code`). Seuls les codes connus sont acceptés : une valeur
// arbitraire de l'adresse ne doit jamais devenir une clé de traduction, ni un texte affiché.
export const GOOGLE_ERROR_CODES = [
  "google_indisponible",
  "google_annule",
  "google_invalide",
  "google_echec",
  "google_email_non_verifie",
  "compte_suspendu",
  "compte_equipe",
  "compte_non_verifie",
  "trop_de_tentatives",
] as const;
export type GoogleErrorCode = (typeof GOOGLE_ERROR_CODES)[number];

export function parseGoogleError(value: string | string[] | undefined): GoogleErrorCode | null {
  const code = Array.isArray(value) ? value[0] : value;
  return (GOOGLE_ERROR_CODES as readonly string[]).includes(code ?? "") ? (code as GoogleErrorCode) : null;
}

export async function GoogleErrorNotice({ code }: { code: GoogleErrorCode | null }) {
  if (!code) return null;
  const t = await getTranslations("Auth");
  return (
    <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {t(`googleError_${code}`)}
    </p>
  );
}
