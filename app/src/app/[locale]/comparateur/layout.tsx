import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SITE_URL } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Compare" });
  const canonical = `${SITE_URL}/${locale}/comparateur`;
  return {
    title: `${t("title")} — Souq Auto`,
    alternates: { canonical },
    openGraph: { title: t("title"), url: canonical, type: "website" },
  };
}

export default function ComparateurLayout({ children }: { children: React.ReactNode }) {
  return children;
}
