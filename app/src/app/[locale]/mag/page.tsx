import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/site";
import { buildBreadcrumbJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Blog" });
  const canonical = `${SITE_URL}/${locale}/mag`;

  return {
    title: `${t("indexTitle")} — Souq Auto`,
    description: t("indexSubtitle"),
    alternates: { canonical },
    openGraph: { title: t("indexTitle"), url: canonical, type: "website" },
  };
}

export default async function BlogIndexPage() {
  const locale = await getLocale();
  const t = await getTranslations("Blog");

  const articles = await prisma.blogArticle.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
  });

  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
    dateStyle: "long",
  });

  const breadcrumbItems = [{ name: t("breadcrumbHome"), href: "/" }, { name: t("indexTitle") }];
  const jsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: t("indexTitle"), url: `${SITE_URL}/${locale}/mag` },
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />

      <Breadcrumbs items={breadcrumbItems} />

      <h1 className="text-2xl font-semibold text-slate-900">{t("indexTitle")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("indexSubtitle")}</p>

      {articles.length === 0 ? (
        <p className="mt-8 text-slate-500">{t("empty")}</p>
      ) : (
        <div className="mt-8 space-y-6">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/mag/${article.slug}`}
              className="block rounded-lg border border-slate-200 p-4 hover:border-slate-300"
            >
              <p className="text-xs text-slate-400">
                {article.publishedAt && dateFormatter.format(article.publishedAt)}
              </p>
              <h2 className="mt-1 text-lg font-medium text-slate-900">
                {locale === "ar" ? article.titleAr : article.titleFr}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {locale === "ar" ? article.excerptAr : article.excerptFr}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
