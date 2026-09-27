import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SITE_URL } from "@/lib/site";
import { localizedAlternates } from "@/lib/seo-alternates";

// Lot 231 — la page du comparateur est un composant client (elle ne peut pas exporter de métadonnées) : titre, description,
// canonique et hreflang sont portés par cette mise en page.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Compare" });
  const canonical = `${SITE_URL}/${locale}/comparateur`;
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localizedAlternates(canonical),
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: canonical, type: "website" },
  };
}

export default function ComparateurLayout({ children }: { children: React.ReactNode }) {
  return children;
}
