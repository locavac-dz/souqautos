import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/site";
import { localizedAlternates } from "@/lib/seo-alternates";
import { getListingCountsPerBrand } from "@/lib/catalogue-stats";
import { buildBreadcrumbJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { brandCategories, CATALOGUE_CATEGORIES, categoryFromSlug, categorySlug, filterCatalogueByCategory } from "@/lib/vehicle-catalogue";

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
    alternates: localizedAlternates(canonical),
    openGraph: { title: t("indexTitle"), url: canonical, type: "website" },
  };
}

export default async function BrandsIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ categorie?: string | string[] }>;
}) {
  const { locale } = await params;
  const { categorie } = await searchParams;
  const t = await getTranslations("Catalogue");
  // Lot 130 — filtre par famille de véhicules (voitures, utilitaires, poids lourds, deux-roues).
  const category = categoryFromSlug(categorie);

  const [allBrands, brandCounts] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" }, include: { models: { select: { id: true, categories: true } } } }),
    getListingCountsPerBrand(),
  ]);
  const brands = filterCatalogueByCategory(allBrands, category);

  const breadcrumbItems = [{ name: t("breadcrumbHome"), href: "/" }, { name: t("indexTitle") }];
  const jsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: t("indexTitle"), url: `${SITE_URL}/${locale}/voitures` },
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />

      <Breadcrumbs items={breadcrumbItems} />

      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("indexTitle")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("indexSubtitle")}</p>

      <nav aria-label={t("filterLabel")} className="mt-4 flex flex-wrap gap-2">
        {[undefined, ...CATALOGUE_CATEGORIES].map((value) => {
          const active = value === category;
          return (
            <Link
              key={value ?? "all"}
              href={value ? `/voitures?categorie=${categorySlug(value)}` : "/voitures"}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${active ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900" : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"}`}
            >
              {value ? t(`category${value}`) : t("filterAll")}
            </Link>
          );
        })}
      </nav>

      {brands.length === 0 && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">{t("emptyCategory")}</p>}

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {brands.map((brand) => {
          const stat = brandCounts.get(brand.id);
          return (
            <Link
              key={brand.id}
              href={`/voitures/${brand.slug}`}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-slate-300 dark:hover:border-slate-600"
            >
              <p className="font-medium text-slate-900 dark:text-slate-100" lang="fr">{brand.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {brandCategories(allBrands.find((b) => b.id === brand.id)!.models).map((c) => t(`category${c}`)).join(" · ")}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("statsCount", { count: stat?.count ?? 0 })}
              </p>
              {stat?.avgPrice && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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
