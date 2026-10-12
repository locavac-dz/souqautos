import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { routing } from "@/i18n/routing";
import { SITE_URL, resolveAbsolutePhotoUrl } from "@/lib/site";
import { publishedNow } from "@/lib/blog-publication";
import { buildRssFeed } from "@/lib/rss";

const FEED_SIZE = 30;

// Lu à chaque requête : un essai programmé doit entrer dans le flux à sa date
// sans reconstruire le site (même raison que le sitemap).
export const dynamic = "force-dynamic";

// Lot 111 — flux RSS des derniers essais parus, dans la langue de l'adresse
// (/fr/essais/feed.xml, /ar/essais/feed.xml). Jamais de brouillon ni d'essai
// programmé : `publishedNow` les exclut, comme pour l'index.
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(routing.locales as readonly string[]).includes(locale)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const isAr = locale === "ar";
  const t = await getTranslations({ locale, namespace: "RoadTest" });

  const articles = await prisma.blogArticle.findMany({
    where: { kind: "ESSAI", ...publishedNow(new Date()) },
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
    link: `${SITE_URL}/${locale}/essais`,
    selfUrl: `${SITE_URL}/${locale}/essais/feed.xml`,
    description: t("indexSubtitle"),
    language: locale,
    lastBuildDate: articles[0]?.publishedAt ?? new Date(),
    items: articles.flatMap((article) =>
      article.publishedAt
        ? [
            {
              title: isAr ? article.titleAr : article.titleFr,
              link: `${SITE_URL}/${locale}/essais/${article.slug}`,
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
