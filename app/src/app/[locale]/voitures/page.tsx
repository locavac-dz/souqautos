import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/site";
import { getListingCountsPerBrand } from "@/lib/catalogue-stats";
import { buildBreadcrumbJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Catalogue" });
  const canonical = `${SITE_URL}/${locale}/voitures`;

  return {
    title: `${t("indexTitle")} — Souq Auto`,
    description: t("indexSubtitle"),
    alternates: { canonical },
    openGraph: { title: t("indexTitle"), url: canonical, type: "website" },
  };
}

export default async function BrandsIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("Catalogue");

  const [brands, brandCounts] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    getListingCountsPerBrand(),
  ]);

  const breadcrumbItems = [{ name: t("breadcrumbHome"), href: "/" }, { name: t("indexTitle") }];
  const jsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: t("indexTitle"), url: `${SITE_URL}/${locale}/voitures` },
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />

      <Breadcrumbs items={breadcrumbItems} />

      <h1 className="text-2xl font-semibold text-slate-900">{t("indexTitle")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("indexSubtitle")}</p>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {brands.map((brand) => {
          const stat = brandCounts.get(brand.id);
          return (
            <Link
              key={brand.id}
              href={`/voitures/${brand.slug}`}
              className="rounded-lg border border-slate-200 p-3 hover:border-slate-300"
            >
              <p className="font-medium text-slate-900">{brand.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {t("statsCount", { count: stat?.count ?? 0 })}
              </p>
              {stat?.avgPrice && (
                <p className="text-xs text-slate-500 mt-1">
                  {t("avgPrice")}: {stat.avgPrice.toLocaleString()} DA
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
