import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { articlePublicPath } from "@/lib/blog";
import { publishedNow } from "@/lib/blog-publication";
import { previewTokenFrom, resolveArticleForViewer } from "@/lib/article-preview";
import { ArticlePreviewBanner } from "@/components/ArticlePreviewBanner";
import { SITE_URL, resolveAbsolutePhotoUrl } from "@/lib/site";
import { buildBreadcrumbJsonLd, buildArticleJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ArticleBody } from "@/components/ArticleBody";

// Publié = date de parution atteinte (Lot 110 : un article programmé reste
// invisible, et renvoie un 404, jusqu'à sa date). Exception (Lot 145) : un ADMINISTRATEUR connecté voit un brouillon ou un article
// programmé en APERÇU, sous un bandeau et sans être indexé (src/lib/article-preview.ts).
async function findArticle(slug: string, publishedOnly: boolean) {
  return prisma.blogArticle.findFirst({ where: { slug, ...(publishedOnly ? publishedNow(new Date()) : {}) } });
}

const getArticleForViewer = (slug: string, previewToken: string | null) =>
  resolveArticleForViewer(() => findArticle(slug, true), () => findArticle(slug, false), { previewToken });

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ apercu?: string | string[] }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolved = await getArticleForViewer(slug, previewTokenFrom((await searchParams).apercu));
  if (!resolved) return {};
  const { article, preview } = resolved;

  const title = locale === "ar" ? article.titleAr : article.titleFr;
  const excerpt = locale === "ar" ? article.excerptAr : article.excerptFr;
  const canonical = `${SITE_URL}/${locale}/mag/${article.slug}`;
  // Un aperçu n'a ni adresse canonique ni partage, et ne doit JAMAIS être indexé : ce contenu n'est pas public.
  if (preview) return { title: `${title} — Souq Auto`, robots: { index: false, follow: false } };

  const coverAbsoluteUrl = article.coverImageUrl ? resolveAbsolutePhotoUrl(article.coverImageUrl) : undefined;
  return {
    title: `${title} — Souq Auto`,
    description: excerpt,
    alternates: { canonical },
    openGraph: {
      title,
      description: excerpt,
      url: canonical,
      type: "article",
      ...(coverAbsoluteUrl && { images: [{ url: coverAbsoluteUrl }] }),
    },
  };
}

export default async function BlogArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ apercu?: string | string[] }>;
}) {
  const { locale, slug } = await params;
  const previewToken = previewTokenFrom((await searchParams).apercu);
  const resolved = await getArticleForViewer(slug, previewToken);
  if (!resolved) notFound();
  const { article, preview } = resolved;
  // Les articles, les essais et les guides partagent le même espace de slugs : un essai (ou un
  // guide) ouvert par son ancienne adresse /mag est renvoyé vers sa rubrique.
  if (article.kind === "ESSAI" || article.kind === "GUIDE") {
    // Le jeton d'un lien de relecture est CONSERVÉ dans le renvoi : sans lui, un relecteur qui ouvrirait ce lien par /mag perdrait son accès.
    const target = articlePublicPath(article.kind, article.slug);
    redirect({ href: preview?.reviewLink && previewToken ? `${target}?apercu=${encodeURIComponent(previewToken)}` : target, locale });
    return null;
  }

  const t = await getTranslations("Blog");
  const title = locale === "ar" ? article.titleAr : article.titleFr;
  const content = locale === "ar" ? article.contentAr : article.contentFr;
  const excerpt = locale === "ar" ? article.excerptAr : article.excerptFr;

  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
    dateStyle: "long",
  });

  const canonical = `${SITE_URL}/${locale}/mag/${article.slug}`;
  const breadcrumbItems = [
    { name: t("breadcrumbHome"), href: "/" },
    { name: t("indexTitle"), href: "/mag" },
    { name: title },
  ];
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: t("indexTitle"), url: `${SITE_URL}/${locale}/mag` },
    { name: title, url: canonical },
  ]);
  // Pas de données structurées pour un aperçu : ce contenu n'est pas public, il n'a pas de date de parution.
  const articleJsonLd = article.publishedAt
    ? buildArticleJsonLd({
        title,
        description: excerpt,
        url: canonical,
        // Éditorial de la marque, jamais attribué publiquement à un compte admin
        // précis (l'auteur réel n'a aucune pertinence pour le lecteur).
        authorName: "Souq Auto",
        datePublished: article.publishedAt.toISOString(),
        dateModified: article.updatedAt.toISOString(),
        isBasedOn: article.sourceUrl ?? undefined,
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {preview && <ArticlePreviewBanner preview={preview} editHref={`/admin/mag/${article.id}/modifier`} />}
      {!preview && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }}
        />
      )}
      {articleJsonLd && !preview && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(articleJsonLd) }} />}

      <Breadcrumbs items={breadcrumbItems} />

      {article.publishedAt && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <time dateTime={article.publishedAt.toISOString()}>{dateFormatter.format(article.publishedAt)}</time>
        </p>
      )}
      <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>

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
            <>
              {t("sourceLabel")}{" "}
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline hover:text-slate-800"
              >
                {article.sourceName}
              </a>
            </>
          ) : (
            <>
              {t("sourceLabel")} {article.sourceName}
            </>
          )}
          {" — "}
          {t("sourceNote")}
        </p>
      )}
    </div>
  );
}
