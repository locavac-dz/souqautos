import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LoginForm } from "@/components/LoginForm";
import { GoogleErrorNotice, GoogleSignInButton, parseGoogleError } from "@/components/GoogleSignInButton";
import { isGoogleLoginEnabled, pickLoginLocale } from "@/lib/google-oauth";
import { SITE_URL } from "@/lib/site";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ erreur?: string | string[]; next?: string | string[] }>;
}) {
  const { locale } = await params;
  const { erreur, next } = await searchParams;
  const t = await getTranslations("Auth");
  const googleEnabled = isGoogleLoginEnabled(process.env, SITE_URL);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">{t("loginTitle")}</h1>
      <GoogleErrorNotice code={parseGoogleError(erreur)} />
      {googleEnabled && <GoogleSignInButton locale={pickLoginLocale(locale)} next={typeof next === "string" ? next : undefined} />}
      <LoginForm />
      <p className="mt-6 text-sm text-slate-500">
        {t("noAccount")}{" "}
        <Link href="/inscription" className="text-slate-900 underline">
          {t("goToRegister")}
        </Link>
      </p>
    </div>
  );
}
