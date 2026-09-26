import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LoginForm } from "@/components/LoginForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  const canonical = `${SITE_URL}/${locale}/connexion`;
  return {
    title: `${t("loginTitle")} — Souq Auto`,
    alternates: { canonical },
    robots: { index: false },
  };
}
import { GoogleErrorNotice, GoogleSignInButton, parseGoogleError } from "@/components/GoogleSignInButton";
import { isGoogleLoginEnabled, pickLoginLocale } from "@/lib/google-oauth";
import { SITE_URL } from "@/lib/site";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ erreur?: string | string[]; next?: string | string[]; reinitialise?: string | string[] }>;
}) {
  const { locale } = await params;
  const { erreur, next, reinitialise } = await searchParams;
  const t = await getTranslations("Auth");
  const googleEnabled = isGoogleLoginEnabled(process.env, SITE_URL);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">{t("loginTitle")}</h1>
      {/* Lot 133 — après une réinitialisation réussie du mot de passe. */}
      {reinitialise === "1" && (
        <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {t("passwordResetDone")}
        </p>
      )}
      <GoogleErrorNotice code={parseGoogleError(erreur)} />
      {googleEnabled && <GoogleSignInButton locale={pickLoginLocale(locale)} next={typeof next === "string" ? next : undefined} />}
      <LoginForm />
      <p className="mt-3 text-sm">
        <Link href="/mot-de-passe-oublie" className="text-slate-600 dark:text-slate-400 underline hover:text-slate-900 dark:hover:text-slate-200">
          {t("forgotPasswordLink")}
        </Link>
      </p>
      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
        {t("noAccount")}{" "}
        <Link href="/inscription" className="text-slate-900 dark:text-slate-100 underline">
          {t("goToRegister")}
        </Link>
      </p>
    </div>
  );
}
