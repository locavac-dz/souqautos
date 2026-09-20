import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

// Lot 133 — page de demande de lien. Hors des moteurs de recherche (robots.txt et « noindex »).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ForgotPasswordPage() {
  const t = await getTranslations("PasswordReset");

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">{t("forgotTitle")}</h1>
      <p className="mb-6 text-sm text-slate-600">{t("forgotIntro")}</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-sm text-slate-500">
        <Link href="/connexion" className="text-slate-900 underline">
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}
