import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { SITE_URL, resolveAbsolutePhotoUrl } from "@/lib/site";
import { buildArticleJsonLd, buildBreadcrumbJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ArticleBody } from "@/components/ArticleBody";
import { publishedNow, shouldShowUpdatedDate } from "@/lib/blog-publication";
import { previewTokenFrom, resolveArticleForViewer } from "@/lib/article-preview";
import { ArticlePreviewBanner } from "@/components/ArticlePreviewBanner";
import { splitLines } from "@/lib/road-test";

// Un guide n'existe publiquement que s'il est de type GUIDE ET paru : un brouillon, un guide programmé,
// un essai ou un article du magazine renvoient un vrai 404. Exception (Lot 145) : un ADMINISTRATEUR connecté voit un brouillon ou un
// guide programmé en APERÇU, sous un bandeau et sans être indexé (src/lib/article-preview.ts).
async function findGuide(slug: string, publishedOnly: boolean) {
  const article = await prisma.blogArticle.findFirst({
    where: { slug, kind: "GUIDE", ...(publishedOnly ? publishedNow(new Date()) : {}) },
    include: {
      guide: { include: { brand: true, model: true, generation: true } },
      author: { include: { profile: true } },
    },
  });
  if (!article || !article.guide) return null;
  return { ...article, guide: article.guide };
}

const getGuideForViewer = (slug: string, previewToken: string | null) =>
  resolveArticleForViewer(() => findGuide(slug, true), () => findGuide(slug, false), { previewToken });

export const revalidate = 3600;

export async function generateMetadata({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ apercu?: string | string[] }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolved = await getGuideForViewer(slug, previewTokenFrom((await searchParams).apercu));
  if (!resolved) return {};
  const { article, preview } = resolved;

  const title = locale === "ar" ? article.titleAr : article.titleFr;
  const excerpt = locale === "ar" ? article.excerptAr : article.excerptFr;
  const canonical = `${SITE_URL}/${locale}/guides/${article.slug}`;
  // Un aperçu n'a ni adresse canonique ni partage, et ne doit JAMAIS être indexé : ce contenu n'est pas public.
  if (preview) return { title: `${title} — Souq Auto`, robots: { index: false, follow: false } };

  return {
    title: `${title} — Souq Auto`,
    description: excerpt,
    alternates: { canonical },
    openGraph: {
      title,
      description: excerpt,
      url: canonical,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      images: article.coverImageUrl ? [resolveAbsolutePhotoUrl(article.coverImageUrl)] : undefined,
    },
  };
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className="mt-0.5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="#059669" strokeWidth="1.8" />
      <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function GuidePage({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ apercu?: string | string[] }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  const resolved = await getGuideForViewer(slug, previewTokenFrom((await searchParams).apercu));
  if (!resolved) notFound();
  const { article, preview } = resolved;

  const t = await getTranslations("Guide");
  const isAr = locale === "ar";
  const g = article.guide;

  const title = isAr ? article.titleAr : article.titleFr;
  const excerpt = isAr ? article.excerptAr : article.excerptFr;
  const content = isAr ? article.contentAr : article.contentFr;
  const advice = isAr ? g.adviceAr : g.adviceFr;
  const checklist = splitLines(isAr ? g.checklistAr : g.checklistFr);

  const profile = article.author.profile;
  const authorName = profile?.displayName ?? "Souq Auto";
  // Lot 144 — un guide GÉNÉRAL n'a ni marque ni modèle : ni ligne de véhicule, ni lien vers une page de modèle.
  const vehicle = g.brand && g.model ? `${g.brand.name} ${g.model.name}` : null;

  const dateFormatter = new Intl.DateTimeFormat(isAr ? "ar-DZ" : "fr-DZ", { dateStyle: "long" });
  const showUpdated = shouldShowUpdatedDate(article.publishedAt, article.updatedAt);

  const canonical = `${SITE_URL}/${locale}/guides/${article.slug}`;
  const breadcrumbItems = [{ name: t("breadcrumbHome"), href: "/" }, { name: t("indexTitle"), href: "/guides" }, { name: title }];
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: t("indexTitle"), url: `${SITE_URL}/${locale}/guides` },
    { name: title, url: canonical },
  ]);
  // Pas de données structurées pour un aperçu : ce contenu n'est pas public, il n'a pas de date de parution.
  const articleJsonLd = article.publishedAt
    ? buildArticleJsonLd({
        title,
        description: excerpt,
        url: canonical,
        datePublished: article.publishedAt.toISOString(),
        dateModified: article.updatedAt.toISOString(),
        authorName,
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {preview && <ArticlePreviewBanner preview={preview} editHref={`/admin/guides/${article.id}/modifier`} />}
      {!preview && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }} />}
      {articleJsonLd && !preview && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(articleJsonLd) }} />}

      <Breadcrumbs items={breadcrumbItems} />

      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {t("kicker")}
        {vehicle && <> · {vehicle}</>}
        {g.generation && <> · {g.generation.name}</>}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">{excerpt}</p>

      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
        <span className="font-medium text-slate-900 dark:text-slate-100">{t("byline", { author: authorName })}</span>
        {/* Un aperçu n'a pas de date de parution : rien à afficher, et pas de séparateur qui pendrait dans le vide. */}
        {article.publishedAt && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {" · "}
            {t("publishedOn", { date: dateFormatter.format(article.publishedAt) })}
            {showUpdated && <> · {t("updatedOn", { date: dateFormatter.format(article.updatedAt) })}</>}
          </span>
        )}
      </p>

      {article.coverImageUrl && (
        <div className="relative mt-6 aspect-video overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700">
          <Image src={article.coverImageUrl} alt="" fill sizes="(min-width: 768px) 768px, 100vw" className="object-cover" loading="eager" fetchPriority="high" />
        </div>
      )}

      <section className="mt-6 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t("checklistTitle")}</h2>
        <ul className="mt-3 space-y-2">
          {checklist.map((item, index) => (
            <li key={index} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300">
              <CheckIcon />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("adviceTitle")}</h2>
        <p className="mt-1 text-slate-800 dark:text-slate-100">{advice}</p>
      </section>

      <ArticleBody content={content} />

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {vehicle && g.brand && g.model ? (
          <>
            <Link href={`/recherche?brandId=${g.brandId}&modelId=${g.modelId}`} className="text-slate-900 dark:text-slate-100 underline hover:text-slate-700 dark:hover:text-slate-300">
              {t("seeListings", { vehicle })}
            </Link>
            <Link href={`/voitures/${g.brand.slug}/${g.model.slug}`} className="text-slate-700 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-slate-100">
              {t("seeModel", { vehicle })}
            </Link>
          </>
        ) : (
          <Link href="/recherche" className="text-slate-900 dark:text-slate-100 underline hover:text-slate-700 dark:hover:text-slate-300">
            {t("seeAllListings")}
          </Link>
        )}
      </div>
    </div>
  );
}
