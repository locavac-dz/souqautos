import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  const canonical = `${SITE_URL}/${locale}/inscription`;
  return {
    title: `${t("registerTitle")} — Souq Auto`,
    alternates: { canonical },
    robots: { index: false },
  };
}
import { RegisterForm } from "@/components/RegisterForm";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { isGoogleLoginEnabled, pickLoginLocale } from "@/lib/google-oauth";

// Lot 132 — la présence du bouton « Continuer avec Google » dépend de la configuration lue à chaque requête, jamais figée
// à la compilation.
export const dynamic = "force-dynamic";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("Auth");
  const wilayas = await prisma.wilaya.findMany({
    select: { id: true, nomFr: true, nomAr: true },
    orderBy: { id: "asc" },
  });

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">{t("registerTitle")}</h1>
      {isGoogleLoginEnabled(process.env, SITE_URL) && <GoogleSignInButton locale={pickLoginLocale(locale)} />}
      <RegisterForm wilayas={wilayas} locale={locale} />
      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
        {t("hasAccount")}{" "}
        <Link href="/connexion" className="text-slate-900 dark:text-slate-100 underline">
          {t("goToLogin")}
        </Link>
      </p>
    </div>
  );
}
