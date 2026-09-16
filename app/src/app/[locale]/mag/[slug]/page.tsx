import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { buildBreadcrumbJsonLd, buildArticleJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";

async function getPublishedArticle(slug: string) {
  const article = await prisma.blogArticle.findUnique({ where: { slug } });
  if (!article || !article.publishedAt) return null;
  return article;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) return {};

  const title = locale === "ar" ? article.titleAr : article.titleFr;
  const excerpt = locale === "ar" ? article.excerptAr : article.excerptFr;
  const canonical = `${SITE_URL}/${locale}/mag/${article.slug}`;

  return {
    title: `${title} — Souq Auto`,
    description: excerpt,
    alternates: { canonical },
    openGraph: { title, description: excerpt, url: canonical, type: "article" },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) notFound();

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
  const articleJsonLd = buildArticleJsonLd({
    title,
    description: excerpt,
    url: canonical,
    // Éditorial de la marque, jamais attribué publiquement à un compte admin
    // précis (l'auteur réel n'a aucune pertinence pour le lecteur).
    authorName: "Souq Auto",
    datePublished: article.publishedAt!.toISOString(),
    dateModified: article.updatedAt.toISOString(),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(articleJsonLd) }} />

      <Breadcrumbs items={breadcrumbItems} />

      <p className="text-xs text-slate-400">{dateFormatter.format(article.publishedAt!)}</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>

      <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-700">
        {content.split(/\n{2,}/).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
