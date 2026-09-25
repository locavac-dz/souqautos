import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/site";
import { getListingCountsPerWilaya } from "@/lib/catalogue-stats";
import { buildBreadcrumbJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Catalogue" });
  const canonical = `${SITE_URL}/${locale}/wilaya`;

  return {
    title: `${t("wilayaIndexTitle")} — Souq Auto`,
    description: t("wilayaIndexSubtitle"),
    alternates: { canonical },
    openGraph: { title: t("wilayaIndexTitle"), url: canonical, type: "website" },
  };
}

export default async function WilayaIndexPage() {
  const locale = await getLocale();
  const t = await getTranslations("Catalogue");

  const [wilayas, wilayaCounts] = await Promise.all([
    prisma.wilaya.findMany({ orderBy: { nomFr: "asc" } }),
    getListingCountsPerWilaya(),
  ]);

  const breadcrumbItems = [{ name: t("breadcrumbHome"), href: "/" }, { name: t("wilayaIndexTitle") }];
  const jsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: t("wilayaIndexTitle"), url: `${SITE_URL}/${locale}/wilaya` },
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />

      <Breadcrumbs items={breadcrumbItems} />

      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("wilayaIndexTitle")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("wilayaIndexSubtitle")}</p>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {wilayas.map((wilaya) => {
          const stat = wilayaCounts.get(wilaya.id);
          const label = locale === "ar" ? wilaya.nomAr : wilaya.nomFr;
          return (
            <Link
              key={wilaya.id}
              href={`/wilaya/${wilaya.slug}`}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-slate-300 dark:hover:border-slate-600"
            >
              <p className="font-medium text-slate-900 dark:text-slate-100">{label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("statsCount", { count: stat?.count ?? 0 })}</p>
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
