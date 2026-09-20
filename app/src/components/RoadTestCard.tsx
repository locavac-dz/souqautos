import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { StarRating } from "@/components/StarRating";
import { formatRating } from "@/lib/road-test";

export type RoadTestCardArticle = {
  slug: string;
  titleFr: string;
  titleAr: string;
  excerptFr: string;
  excerptAr: string;
  publishedAt: Date | null;
  coverImageUrl?: string | null;
  roadTest: { rating: number; brand: { name: string } | null; model: { name: string } | null } | null;
};

// Lot 110 — carte d'un essai, partagée par l'index /essais et la page d'un
// modèle du catalogue.
export async function RoadTestCard({ article, locale }: { article: RoadTestCardArticle; locale: string }) {
  const t = await getTranslations("RoadTest");
  const isAr = locale === "ar";
  const dateFormatter = new Intl.DateTimeFormat(isAr ? "ar-DZ" : "fr-DZ", { dateStyle: "long" });
  const vehicle = [article.roadTest?.brand?.name, article.roadTest?.model?.name].filter(Boolean).join(" ");

  return (
    <Link
      href={`/essais/${article.slug}`}
      className="flex flex-col overflow-hidden rounded-lg border border-slate-200 hover:border-slate-300"
    >
      {article.coverImageUrl && (
        <div className="relative aspect-video bg-slate-100">
          <Image
            src={article.coverImageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 384px, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        {vehicle && <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{vehicle}</p>}
        <h2 className="mt-1 text-lg font-medium text-slate-900">{isAr ? article.titleAr : article.titleFr}</h2>
        {article.roadTest && (
          <div className="mt-2 flex items-center gap-2">
            <StarRating
              rating={article.roadTest.rating}
              size={16}
              label={t("ratingAria", { rating: formatRating(article.roadTest.rating, locale) })}
            />
            <span className="text-xs text-slate-500">
              {t("ratingLabel", { rating: formatRating(article.roadTest.rating, locale) })}
            </span>
          </div>
        )}
        <p className="mt-2 text-sm text-slate-600">{isAr ? article.excerptAr : article.excerptFr}</p>
        <p className="mt-auto pt-3 text-xs text-slate-500">
          {article.publishedAt && dateFormatter.format(article.publishedAt)}
        </p>
      </div>
    </Link>
  );
}
