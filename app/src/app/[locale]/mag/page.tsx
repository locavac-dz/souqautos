import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { SITE_URL, resolveAbsolutePhotoUrl } from "@/lib/site";
import { buildBreadcrumbJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Pagination } from "@/components/search/Pagination";
import { publishedNow } from "@/lib/blog-publication";
import { pageWindow } from "@/lib/pagination";
import { numeric } from "@/lib/validation/search";

const PAGE_SIZE = 12;
const paramsSchema = z.object({ page: numeric() });

type RawSearchParams = Promise<Record<string, string | string[] | undefined>>;

async function parsePage(searchParams: RawSearchParams) {
  const raw = await searchParams;
  const value = raw.page;
  return paramsSchema.parse({ page: Array.isArray(value) ? value[0] : value }).page;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: RawSearchParams;
}): Promise<Metadata> {
  const { locale } = await params;
  const page = await parsePage(searchParams);
  const t = await getTranslations({ locale, namespace: "Blog" });
  const canonical = `${SITE_URL}/${locale}/mag${page && page > 1 ? `?page=${page}` : ""}`;

  return {
    title: `${t("indexTitle")} — Souq Auto`,
    description: t("indexSubtitle"),
    alternates: {
      canonical,
      types: { "application/rss+xml": `${SITE_URL}/${locale}/mag/feed.xml` },
    },
    openGraph: { title: t("indexTitle"), url: canonical, type: "website" },
  };
}

export default async function BlogIndexPage({ searchParams }: { searchParams: RawSearchParams }) {
  const locale = await getLocale();
  const t = await getTranslations("Blog");
  const requestedPage = await parsePage(searchParams);

  const where = { kind: "ARTICLE" as const, ...publishedNow(new Date()) };
  const totalCount = await prisma.blogArticle.count({ where });
  const { page, totalPages, skip } = pageWindow(totalCount, requestedPage, PAGE_SIZE);

  const articles = await prisma.blogArticle.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      slug: true,
      titleFr: true,
      titleAr: true,
      excerptFr: true,
      excerptAr: true,
      publishedAt: true,
      coverImageUrl: true,
    },
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

      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("indexTitle")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("indexSubtitle")}</p>
      <p className="mt-1 text-xs">
        <a href={`/${locale}/mag/feed.xml`} className="text-slate-500 dark:text-slate-400 underline hover:text-slate-900 dark:hover:text-slate-200">
          {t("rssLink")}
        </a>
      </p>

      {articles.length === 0 ? (
        <p className="mt-8 text-slate-500 dark:text-slate-400">{t("empty")}</p>
      ) : (
        <>
          <div className="mt-8 space-y-6">
            {articles.map((article) => {
              const title = locale === "ar" ? article.titleAr : article.titleFr;
              const excerpt = locale === "ar" ? article.excerptAr : article.excerptFr;
              const coverUrl = article.coverImageUrl ? resolveAbsolutePhotoUrl(article.coverImageUrl) : null;
              return (
                <Link
                  key={article.id}
                  href={`/mag/${article.slug}`}
                  className="flex gap-4 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-slate-300 dark:hover:border-slate-500"
                >
                  {coverUrl && (
                    <div className="relative aspect-video w-32 shrink-0">
                      <Image
                        src={coverUrl}
                        alt=""
                        fill
                        sizes="128px"
                        className="rounded-md object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {article.publishedAt && dateFormatter.format(article.publishedAt)}
                    </p>
                    <h2 className="mt-1 text-lg font-medium text-slate-900 dark:text-slate-100">{title}</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{excerpt}</p>
                  </div>
                </Link>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} searchParams={{}} basePath="/mag" />
        </>
      )}
    </div>
  );
}
