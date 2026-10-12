import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { localizedAlternates } from "@/lib/seo-alternates";
import { buildBreadcrumbJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Pagination } from "@/components/search/Pagination";
import { RoadTestCard } from "@/components/RoadTestCard";
import { PressReviewCard } from "@/components/PressReviewCard";
import { Link } from "@/i18n/navigation";
import { publishedNow } from "@/lib/blog-publication";
import { pageWindow } from "@/lib/pagination";
import { numeric } from "@/lib/validation/search";

const ESSAIS_PAGE_SIZE = 12;
const PRESS_PREVIEW_SIZE = 6;
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
  const t = await getTranslations({ locale, namespace: "RoadTest" });
  const canonical = `${SITE_URL}/${locale}/essais${page && page > 1 ? `?page=${page}` : ""}`;

  return {
    title: `${t("indexTitle")} — Souq Autos`,
    description: t("indexSubtitle"),
    // Lot 111 — signale le flux RSS aux lecteurs et navigateurs.
    alternates: { ...localizedAlternates(canonical), types: { "application/rss+xml": `${SITE_URL}/${locale}/essais/feed.xml` } },
    openGraph: { title: t("indexTitle"), url: canonical, type: "website" },
  };
}

export default async function RoadTestsIndexPage({ searchParams }: { searchParams: RawSearchParams }) {
  const locale = await getLocale();
  const t = await getTranslations("RoadTest");
  const tPress = await getTranslations("PressReview");
  const requestedPage = await parsePage(searchParams);

  // Seuls les essais parus (`publishedAt` atteint) : un essai programmé reste
  // invisible jusqu'à sa date, sans aucune action.
  const where = { kind: "ESSAI" as const, ...publishedNow(new Date()) };
  const totalCount = await prisma.blogArticle.count({ where });
  const { page, totalPages, skip } = pageWindow(totalCount, requestedPage, ESSAIS_PAGE_SIZE);

  // Lot 114 — revue de presse : les derniers liens vers des essais publiés
  // ailleurs, sur la première page seulement.
  const pressWhere = publishedNow(new Date());
  const [pressCount, pressItems] =
    page === 1
      ? await Promise.all([
          prisma.pressReview.count({ where: pressWhere }),
          prisma.pressReview.findMany({
            where: pressWhere,
            orderBy: { publishedAt: "desc" },
            take: PRESS_PREVIEW_SIZE,
            include: {
              brand: { select: { name: true, slug: true } },
              model: { select: { name: true, slug: true } },
            },
          }),
        ])
      : [0, []];

  const articles = await prisma.blogArticle.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    skip,
    take: ESSAIS_PAGE_SIZE,
    select: {
      id: true,
      slug: true,
      titleFr: true,
      titleAr: true,
      excerptFr: true,
      excerptAr: true,
      publishedAt: true,
      coverImageUrl: true,
      roadTest: { select: { rating: true, brand: { select: { name: true } }, model: { select: { name: true } } } },
    },
  });

  const breadcrumbItems = [{ name: t("breadcrumbHome"), href: "/" }, { name: t("indexTitle") }];
  const jsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: t("indexTitle"), url: `${SITE_URL}/${locale}/essais` },
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />

      <Breadcrumbs items={breadcrumbItems} />

      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("indexTitle")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("indexSubtitle")}</p>
      <p className="mt-1 text-xs">
        {/* Lien natif : un flux XML n'est pas une page de l'application (pas de préfixe de langue à ajouter). */}
        <a href={`/${locale}/essais/feed.xml`} className="text-slate-500 underline hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
          {t("rssLink")}
        </a>
      </p>

      {articles.length === 0 ? (
        <p className="mt-8 py-12 text-center text-slate-500 dark:text-slate-400">{t("empty")}</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <RoadTestCard key={article.id} article={article} locale={locale} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} searchParams={{}} basePath="/essais" />
        </>
      )}

      {pressItems.length > 0 && (
        <section className="mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{tPress("sectionTitle")}</h2>
            {pressCount > pressItems.length && (
              <Link href="/essais/revue-de-presse" className="text-sm text-slate-600 underline hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
                {tPress("seeAll", { count: pressCount })}
              </Link>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tPress("disclaimer")}</p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pressItems.map((item) => (
              <PressReviewCard key={item.id} item={item} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
