import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { RegisterForm } from "@/components/RegisterForm";

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
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">{t("registerTitle")}</h1>
      <RegisterForm wilayas={wilayas} locale={locale} />
      <p className="mt-6 text-sm text-slate-500">
        {t("hasAccount")}{" "}
        <Link href="/connexion" className="text-slate-900 underline">
          {t("goToLogin")}
        </Link>
      </p>
    </div>
  );
}
