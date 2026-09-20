import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { isResetTokenUsable } from "@/lib/password-reset-service";

// Lot 133 — page ouverte depuis le lien du courriel. Le jeton figure dans l'adresse : la page n'est jamais indexée, et
// « no-referrer » empêche l'adresse (donc le jeton) d'être transmise à un autre site par un lien de la page.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("PasswordReset");
  const usable = await isResetTokenUsable(token);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      {usable ? (
        <>
          <h1 className="mb-6 text-2xl font-semibold text-slate-900">{t("resetTitle")}</h1>
          <ResetPasswordForm token={token} />
        </>
      ) : (
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-slate-900">{t("invalidLinkTitle")}</h1>
          <p className="text-sm text-slate-600">{t("invalidLinkBody")}</p>
          <p className="text-sm">
            <Link href="/mot-de-passe-oublie" className="text-slate-900 underline">
              {t("requestAnother")}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
