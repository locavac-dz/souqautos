import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { buildBreadcrumbJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Pagination } from "@/components/search/Pagination";
import { GuideCard, guideCardSelect } from "@/components/GuideCard";
import { publishedNow } from "@/lib/blog-publication";
import { pageWindow } from "@/lib/pagination";
import { numeric } from "@/lib/validation/search";

// Lot 126 — index des guides d'achat par modèle.
const GUIDES_PAGE_SIZE = 12;
const paramsSchema = z.object({ page: numeric() });

type RawSearchParams = Promise<Record<string, string | string[] | undefined>>;

async function parsePage(searchParams: RawSearchParams) {
  const raw = await searchParams;
  const value = raw.page;
  return paramsSchema.parse({ page: Array.isArray(value) ? value[0] : value }).page;
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: RawSearchParams }): Promise<Metadata> {
  const { locale } = await params;
  const page = await parsePage(searchParams);
  const t = await getTranslations({ locale, namespace: "Guide" });
  const canonical = `${SITE_URL}/${locale}/guides${page && page > 1 ? `?page=${page}` : ""}`;
  return {
    title: `${t("indexTitle")} — Souq Auto`,
    description: t("indexSubtitle"),
    alternates: {
      canonical,
      types: { "application/rss+xml": `${SITE_URL}/${locale}/guides/feed.xml` },
    },
    openGraph: { title: t("indexTitle"), url: canonical, type: "website" },
  };
}

export default async function GuidesIndexPage({ searchParams }: { searchParams: RawSearchParams }) {
  const locale = await getLocale();
  const t = await getTranslations("Guide");
  const requestedPage = await parsePage(searchParams);

  // Seuls les guides parus : un guide programmé reste invisible jusqu'à sa date.
  const where = { kind: "GUIDE" as const, ...publishedNow(new Date()) };
  const totalCount = await prisma.blogArticle.count({ where });
  const { page, totalPages, skip } = pageWindow(totalCount, requestedPage, GUIDES_PAGE_SIZE);

  const articles = await prisma.blogArticle.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    skip,
    take: GUIDES_PAGE_SIZE,
    select: guideCardSelect,
  });

  const breadcrumbItems = [{ name: t("breadcrumbHome"), href: "/" }, { name: t("indexTitle") }];
  const jsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: t("indexTitle"), url: `${SITE_URL}/${locale}/guides` },
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />
      <Breadcrumbs items={breadcrumbItems} />

      <h1 className="text-2xl font-semibold text-slate-900">{t("indexTitle")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("indexSubtitle")}</p>
      <p className="mt-1 text-xs">
        <a href={`/${locale}/guides/feed.xml`} className="text-slate-500 underline hover:text-slate-900">
          {t("rssLink")}
        </a>
      </p>

      {articles.length === 0 ? (
        <p className="mt-8 py-12 text-center text-slate-500">{t("empty")}</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <GuideCard key={article.id} article={article} locale={locale} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} searchParams={{}} basePath="/guides" />
        </>
      )}
    </div>
  );
}
