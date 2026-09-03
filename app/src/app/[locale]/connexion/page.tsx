import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const t = await getTranslations("Auth");

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">{t("loginTitle")}</h1>
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
