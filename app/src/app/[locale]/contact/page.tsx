import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Contact");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function ContactPage() {
  const t = await getTranslations("Contact");
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">{t("pageTitle")}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">{t("pageSubtitle")}</p>
      <ContactForm />
    </div>
  );
}
