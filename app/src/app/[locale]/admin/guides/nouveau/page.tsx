import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isEditor } from "@/lib/auth-server/roles";
import { BlogArticleForm } from "@/components/admin/BlogArticleForm";
import { getCatalogueForRoadTests } from "@/lib/road-test-catalogue";
import { prisma } from "@/lib/prisma";
import { parseModelParam } from "@/lib/editorial";

export default async function NewGuidePage({ searchParams }: { searchParams: Promise<{ modele?: string | string[] }> }) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user || !isEditor(user.role)) {
    redirect({ href: "/admin", locale });
    return null;
  }

  const t = await getTranslations("AdminGuide");
  const brands = await getCatalogueForRoadTests();

  // Lot 127 — `?modele=` propose un modèle du catalogue ; un identifiant inconnu est simplement ignoré.
  const requestedModelId = parseModelParam((await searchParams).modele);
  const requestedModel = requestedModelId ? await prisma.model.findUnique({ where: { id: requestedModelId }, select: { id: true, brandId: true } }) : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">{t("newGuide")}</h1>
      <BlogArticleForm kind="GUIDE" brands={brands} defaultModel={requestedModel ? { brandId: requestedModel.brandId, modelId: requestedModel.id } : undefined} />
    </div>
  );
}
