import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { buildBreadcrumbJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Pagination } from "@/components/search/Pagination";
import { PressReviewCard } from "@/components/PressReviewCard";
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
  const t = await getTranslations({ locale, namespace: "PressReview" });
  const canonical = `${SITE_URL}/${locale}/essais/revue-de-presse${page && page > 1 ? `?page=${page}` : ""}`;

  return {
    title: `${t("pageTitle")} — Souq Auto`,
    description: t("pageSubtitle"),
    alternates: { canonical },
    openGraph: { title: t("pageTitle"), url: canonical, type: "website" },
  };
}

export default async function PressReviewsPage({ searchParams }: { searchParams: RawSearchParams }) {
  const locale = await getLocale();
  const t = await getTranslations("PressReview");
  const tRoadTest = await getTranslations("RoadTest");
  const requestedPage = await parsePage(searchParams);

  const where = publishedNow(new Date());
  const totalCount = await prisma.pressReview.count({ where });
  const { page, totalPages, skip } = pageWindow(totalCount, requestedPage, PAGE_SIZE);

  const items = await prisma.pressReview.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    skip,
    take: PAGE_SIZE,
    include: {
      brand: { select: { name: true, slug: true } },
      model: { select: { name: true, slug: true } },
    },
  });

  const breadcrumbItems = [
    { name: tRoadTest("breadcrumbHome"), href: "/" },
    { name: tRoadTest("indexTitle"), href: "/essais" },
    { name: t("pageTitle") },
  ];
  const jsonLd = buildBreadcrumbJsonLd([
    { name: tRoadTest("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: tRoadTest("indexTitle"), url: `${SITE_URL}/${locale}/essais` },
    { name: t("pageTitle"), url: `${SITE_URL}/${locale}/essais/revue-de-presse` },
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />

      <Breadcrumbs items={breadcrumbItems} />

      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("pageTitle")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("pageSubtitle")}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("disclaimer")}</p>

      {items.length === 0 ? (
        <p className="mt-8 py-12 text-center text-slate-500 dark:text-slate-400">{t("empty")}</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <PressReviewCard key={item.id} item={item} locale={locale} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} searchParams={{}} basePath="/essais/revue-de-presse" />
        </>
      )}
    </div>
  );
}
