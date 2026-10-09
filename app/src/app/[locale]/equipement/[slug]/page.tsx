import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { SITE_URL, resolveAbsolutePhotoUrl } from "@/lib/site";
import { localizedAlternates } from "@/lib/seo-alternates";
import { buildBreadcrumbJsonLd, buildArticleJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ArticleBody } from "@/components/ArticleBody";
import { publishedNow, shouldShowUpdatedDate } from "@/lib/blog-publication";
import { previewTokenFrom, resolveArticleForViewer } from "@/lib/article-preview";
import { ArticlePreviewBanner } from "@/components/ArticlePreviewBanner";

async function findEquipement(slug: string, publishedOnly: boolean) {
  return prisma.blogArticle.findFirst({
    where: { slug, kind: "EQUIPEMENT", ...(publishedOnly ? publishedNow(new Date()) : {}) },
    include: { author: { include: { profile: true } } },
  });
}

const getEquipementForViewer = (slug: string, previewToken: string | null) =>
  resolveArticleForViewer(
    () => findEquipement(slug, true),
    () => findEquipement(slug, false),
    { previewToken }
  );

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ apercu?: string | string[] }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolved = await getEquipementForViewer(slug, previewTokenFrom((await searchParams).apercu));
  if (!resolved) return {};
  const { article, preview } = resolved;

  const title = locale === "ar" ? article.titleAr : article.titleFr;
  const excerpt = locale === "ar" ? article.excerptAr : article.excerptFr;
  const canonical = `${SITE_URL}/${locale}/equipement/${article.slug}`;
  if (preview) return { title: `${title} — Souq Auto`, robots: { index: false, follow: false } };

  const coverAbsoluteUrl = article.coverImageUrl ? resolveAbsolutePhotoUrl(article.coverImageUrl) : undefined;
  return {
    title: `${title} — Souq Auto`,
    description: excerpt,
    alternates: { ...localizedAlternates(canonical), types: { "application/rss+xml": `${SITE_URL}/${locale}/equipement/feed.xml` } },
    openGraph: {
      title,
      description: excerpt,
      url: canonical,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      ...(coverAbsoluteUrl && { images: [{ url: coverAbsoluteUrl }] }),
    },
  };
}

export default async function EquipementArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ apercu?: string | string[] }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();
  const previewToken = previewTokenFrom((await searchParams).apercu);
  const resolved = await getEquipementForViewer(slug, previewToken);
  if (!resolved) notFound();
  const { article, preview } = resolved;

  const t = await getTranslations("Equipement");
  const isAr = locale === "ar";

  const title = isAr ? article.titleAr : article.titleFr;
  const excerpt = isAr ? article.excerptAr : article.excerptFr;
  const content = isAr ? article.contentAr : article.contentFr;

  const profile = article.author.profile;
  const authorName = profile?.displayName ?? "Souq Auto";

  const bcp47 = isAr ? "ar-DZ" : "fr-DZ";
  const dateFormatter = new Intl.DateTimeFormat(bcp47, { dateStyle: "long" });
  const showUpdated = shouldShowUpdatedDate(article.publishedAt, article.updatedAt);

  const canonical = `${SITE_URL}/${locale}/equipement/${article.slug}`;
  const breadcrumbItems = [
    { name: t("breadcrumbHome"), href: "/" },
    { name: t("indexTitle"), href: "/equipement" },
    { name: title },
  ];
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: t("indexTitle"), url: `${SITE_URL}/${locale}/equipement` },
    { name: title, url: canonical },
  ]);
  const articleJsonLd = article.publishedAt
    ? buildArticleJsonLd({
        title,
        description: excerpt,
        url: canonical,
        authorName,
        datePublished: article.publishedAt.toISOString(),
        dateModified: article.updatedAt.toISOString(),
        isBasedOn: article.sourceUrl ?? undefined,
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {preview && <ArticlePreviewBanner preview={preview} editHref={`/admin/equipement/${article.id}/modifier`} />}
      {!preview && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }} />}
      {articleJsonLd && !preview && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(articleJsonLd) }} />}

      <Breadcrumbs items={breadcrumbItems} />

      {article.publishedAt && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <time dateTime={article.publishedAt.toISOString()}>{dateFormatter.format(article.publishedAt)}</time>
          {showUpdated && <> · {t("updatedOn", { date: dateFormatter.format(article.updatedAt) })}</>}
        </p>
      )}
      <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">{excerpt}</p>

      {article.coverImageUrl && (
        <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-lg">
          <Image
            src={resolveAbsolutePhotoUrl(article.coverImageUrl)}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            priority
          />
        </div>
      )}

      <ArticleBody content={content} />

      {article.sourceName && (
        <p className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-4 text-xs text-slate-500 dark:text-slate-400">
          {article.sourceUrl ? (
            <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-slate-800">
              {article.sourceName}
            </a>
          ) : (
            article.sourceName
          )}
        </p>
      )}

      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
        <a href={`/${locale}/equipement/feed.xml`} className="underline hover:text-slate-900 dark:hover:text-slate-200">
          {t("rssLink")}
        </a>
      </p>
    </div>
  );
}
