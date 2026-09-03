import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { BecomeProForm } from "@/components/BecomeProForm";

export default async function BecomeProPage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }
  if (user.professionalAccount) {
    redirect({ href: "/pro/tableau-de-bord", locale });
    return null;
  }

  const t = await getTranslations("Pro");
  const wilayas = await prisma.wilaya.findMany({ orderBy: { id: "asc" } });

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">{t("becomeProTitle")}</h1>
      <p className="text-sm text-slate-500 mb-6">{t("becomeProSubtitle")}</p>
      <BecomeProForm wilayas={wilayas} />
    </div>
  );
}
