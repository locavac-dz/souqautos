import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { TwoFactorVerifyForm } from "@/components/TwoFactorVerifyForm";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { getPendingFromCookies } from "@/lib/auth-server/two-factor-pending";

// Lot 138 — seconde étape de la connexion (double authentification). Jamais indexée (déjà exclue de robots.txt : « /*/connexion »).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TwoFactorVerificationPage() {
  const locale = await getLocale();
  // Déjà connecté : rien à vérifier. Aucune connexion en attente (cookie absent ou expiré) : retour à la première étape.
  if (await getCurrentUser()) {
    redirect({ href: "/compte/tableau-de-bord", locale });
    return null;
  }
  if (!(await getPendingFromCookies())) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("TwoFactor");
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">{t("verifyTitle")}</h1>
      <TwoFactorVerifyForm />
    </div>
  );
}
