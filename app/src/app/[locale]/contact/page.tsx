import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/site";

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
      <div className="mb-8 flex justify-center">
        <a
          href={`mailto:${PUBLIC_CONTACT_EMAIL}`}
          className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-10 py-6 text-center shadow-sm transition-colors hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-700"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0-.621.504-1.125 1.125-1.125h17.25c.621 0 1.125.504 1.125 1.125v10.5c0 .621-.504 1.125-1.125 1.125H3.375A1.125 1.125 0 0 1 2.25 17.25V6.75Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75 12 13.5l9.75-6.75" />
          </svg>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("emailCardTitle")}</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">{PUBLIC_CONTACT_EMAIL}</span>
        </a>
      </div>
      <ContactForm />
    </div>
  );
}
