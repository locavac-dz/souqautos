import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { InsuranceForm } from "@/components/InsuranceForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Insurance");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function InsurancePage() {
  const t = await getTranslations("Insurance");
  const wilayas = await prisma.wilaya.findMany({ orderBy: { id: "asc" } });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">{t("pageTitle")}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">{t("pageSubtitle")}</p>
      <InsuranceForm wilayas={wilayas.map((w) => ({ id: w.id, nomFr: w.nomFr, nomAr: w.nomAr }))} />
    </div>
  );
}
