import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { routing } from "@/i18n/routing";
import { SITE_URL, resolveAbsolutePhotoUrl } from "@/lib/site";
import { publishedNow } from "@/lib/blog-publication";
import { buildRssFeed } from "@/lib/rss";

const FEED_SIZE = 30;

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(routing.locales as readonly string[]).includes(locale)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const isAr = locale === "ar";
  const t = await getTranslations({ locale, namespace: "Guide" });

  const articles = await prisma.blogArticle.findMany({
    where: { kind: "GUIDE", ...publishedNow(new Date()) },
    orderBy: { publishedAt: "desc" },
    take: FEED_SIZE,
    select: {
      slug: true,
      titleFr: true,
      titleAr: true,
      excerptFr: true,
      excerptAr: true,
      publishedAt: true,
      coverImageUrl: true,
    },
  });

  const feed = buildRssFeed({
    title: `${t("indexTitle")} — Souq Autos`,
    link: `${SITE_URL}/${locale}/guides`,
    selfUrl: `${SITE_URL}/${locale}/guides/feed.xml`,
    description: t("indexSubtitle"),
    language: locale,
    lastBuildDate: articles[0]?.publishedAt ?? new Date(),
    items: articles.flatMap((article) =>
      article.publishedAt
        ? [
            {
              title: isAr ? article.titleAr : article.titleFr,
              link: `${SITE_URL}/${locale}/guides/${article.slug}`,
              description: isAr ? article.excerptAr : article.excerptFr,
              pubDate: article.publishedAt,
              imageUrl: article.coverImageUrl ? resolveAbsolutePhotoUrl(article.coverImageUrl) : null,
            },
          ]
        : []
    ),
  });

  return new NextResponse(feed, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
