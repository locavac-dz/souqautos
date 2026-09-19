import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { SITE_URL, resolveAbsolutePhotoUrl } from "@/lib/site";
import { buildBreadcrumbJsonLd, buildReviewJsonLd, safeJsonLdStringify } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { StarRating } from "@/components/StarRating";
import { ArticleBody } from "@/components/ArticleBody";
import { publishedNow, shouldShowUpdatedDate } from "@/lib/blog-publication";
import { formatRating, splitLines } from "@/lib/road-test";

// Un essai n'existe publiquement que s'il est de type ESSAI ET paru : un
// brouillon, un essai programmé ou un article du magazine renvoient un vrai 404.
async function getPublishedRoadTest(slug: string) {
  const article = await prisma.blogArticle.findFirst({
    where: { slug, kind: "ESSAI", ...publishedNow(new Date()) },
    include: {
      roadTest: { include: { brand: true, model: true } },
      author: { include: { profile: true } },
    },
  });
  if (!article || !article.roadTest || !article.publishedAt) return null;
  return { ...article, roadTest: article.roadTest, publishedAt: article.publishedAt };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await getPublishedRoadTest(slug);
  if (!article) return {};

  const title = locale === "ar" ? article.titleAr : article.titleFr;
  const excerpt = locale === "ar" ? article.excerptAr : article.excerptFr;
  const canonical = `${SITE_URL}/${locale}/essais/${article.slug}`;

  return {
    title: `${title} — Souq Auto`,
    description: excerpt,
    alternates: { canonical },
    openGraph: {
      title,
      description: excerpt,
      url: canonical,
      type: "article",
      publishedTime: article.publishedAt.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      images: article.coverImageUrl ? [resolveAbsolutePhotoUrl(article.coverImageUrl)] : undefined,
    },
  };
}

function BulletIcon({ kind }: { kind: "plus" | "minus" }) {
  const color = kind === "plus" ? "#059669" : "#dc2626";
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className="mt-0.5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="1.8" />
      <path d={kind === "plus" ? "M7.5 12h9M12 7.5v9" : "M7.5 12h9"} stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default async function RoadTestPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();
  const article = await getPublishedRoadTest(slug);
  if (!article) notFound();

  const t = await getTranslations("RoadTest");
  const isAr = locale === "ar";
  const rt = article.roadTest;

  const title = isAr ? article.titleAr : article.titleFr;
  const excerpt = isAr ? article.excerptAr : article.excerptFr;
  const content = isAr ? article.contentAr : article.contentFr;
  const verdict = isAr ? rt.verdictAr : rt.verdictFr;
  const pros = splitLines(isAr ? rt.prosAr : rt.prosFr);
  const cons = splitLines(isAr ? rt.consAr : rt.consFr);

  const profile = article.author.profile;
  const authorName = profile?.displayName ?? "Souq Auto";
  const vehicle = [rt.brand?.name, rt.model?.name].filter(Boolean).join(" ");

  const bcp47 = isAr ? "ar-DZ" : "fr-DZ";
  const dateFormatter = new Intl.DateTimeFormat(bcp47, { dateStyle: "long" });
  const showUpdated = shouldShowUpdatedDate(article.publishedAt, article.updatedAt);
  const ratingText = formatRating(rt.rating, locale);

  const canonical = `${SITE_URL}/${locale}/essais/${article.slug}`;
  const breadcrumbItems = [
    { name: t("breadcrumbHome"), href: "/" },
    { name: t("indexTitle"), href: "/essais" },
    { name: title },
  ];
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: `${SITE_URL}/${locale}` },
    { name: t("indexTitle"), url: `${SITE_URL}/${locale}/essais` },
    { name: title, url: canonical },
  ]);
  const reviewJsonLd = buildReviewJsonLd({
    url: canonical,
    title,
    verdict,
    itemName: vehicle || title,
    brandName: rt.brand?.name,
    ratingValue: rt.rating,
    authorName,
    authorIsPerson: Boolean(profile),
    datePublished: article.publishedAt.toISOString(),
    dateModified: article.updatedAt.toISOString(),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(reviewJsonLd) }} />

      <Breadcrumbs items={breadcrumbItems} />

      {vehicle && <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{vehicle}</p>}
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-slate-600">{excerpt}</p>

      <div className="mt-4 flex items-center gap-3">
        {profile?.avatarUrl ? (
          <div className="relative h-10 w-10 shrink-0">
            <Image
              src={profile.avatarUrl}
              alt=""
              fill
              sizes="40px"
              className="rounded-full object-cover border border-slate-200"
            />
          </div>
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-medium text-slate-500">
            {authorName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="text-sm">
          <p className="font-medium text-slate-900">{t("byline", { author: authorName })}</p>
          <p className="text-xs text-slate-500">
            {t("publishedOn", { date: dateFormatter.format(article.publishedAt) })}
            {showUpdated && <> · {t("updatedOn", { date: dateFormatter.format(article.updatedAt) })}</>}
          </p>
        </div>
      </div>

      {article.coverImageUrl && (
        <div className="relative mt-6 aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          <Image src={article.coverImageUrl} alt="" fill sizes="(min-width: 768px) 768px, 100vw" className="object-cover" priority />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <StarRating rating={rt.rating} size={26} label={t("ratingAria", { rating: ratingText })} />
        <span className="text-lg font-semibold text-slate-900">{t("ratingLabel", { rating: ratingText })}</span>
      </div>

      {(rt.testedVersion || rt.testedAt) && (
        <p className="mt-3 text-xs text-slate-500">
          {rt.testedVersion && <span>{t("testedVersion", { version: rt.testedVersion })}</span>}
          {rt.testedVersion && rt.testedAt && " · "}
          {rt.testedAt && <span>{t("testedOn", { date: dateFormatter.format(rt.testedAt) })}</span>}
        </p>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">{t("prosTitle")}</h2>
          <ul className="mt-3 space-y-2">
            {pros.map((item, index) => (
              <li key={index} className="flex gap-2 text-sm text-slate-700">
                <BulletIcon kind="plus" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900">{t("consTitle")}</h2>
          <ul className="mt-3 space-y-2">
            {cons.map((item, index) => (
              <li key={index} className="flex gap-2 text-sm text-slate-700">
                <BulletIcon kind="minus" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("verdictTitle")}</h2>
        <p className="mt-1 text-slate-800">{verdict}</p>
      </section>

      <ArticleBody content={content} />

      {rt.brand && rt.model && (
        <Link
          href={`/voitures/${rt.brand.slug}/${rt.model.slug}`}
          className="mt-8 inline-block text-sm text-slate-700 underline hover:text-slate-900"
        >
          {t("seeModel", { brand: rt.brand.name, model: rt.model.name })}
        </Link>
      )}
    </div>
  );
}
