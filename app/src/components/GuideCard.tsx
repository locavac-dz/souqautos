import Image from "next/image";
import { Link } from "@/i18n/navigation";

export type GuideCardArticle = {
  slug: string;
  titleFr: string;
  titleAr: string;
  excerptFr: string;
  excerptAr: string;
  publishedAt: Date | null;
  coverImageUrl?: string | null;
  // Lot 144 — un guide GÉNÉRAL n'a ni marque ni modèle : la carte n'affiche alors aucune ligne de véhicule.
  guide: { brand: { name: string } | null; model: { name: string } | null } | null;
};

// Lot 126 — carte d'un guide d'achat, partagée par l'index /guides et la page d'un modèle du catalogue.
export function GuideCard({ article, locale }: { article: GuideCardArticle; locale: string }) {
  const isAr = locale === "ar";
  const dateFormatter = new Intl.DateTimeFormat(isAr ? "ar-DZ" : "fr-DZ", { dateStyle: "long" });
  const vehicle = article.guide?.brand && article.guide.model ? `${article.guide.brand.name} ${article.guide.model.name}` : "";

  return (
    <article>
      <Link href={`/guides/${article.slug}`} className="flex flex-col overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500">
        {article.coverImageUrl && (
          <div className="relative aspect-video bg-slate-100 dark:bg-slate-700">
            <Image src={article.coverImageUrl} alt="" fill sizes="(min-width: 1024px) 384px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
          </div>
        )}
        <div className="flex flex-1 flex-col p-4">
          {vehicle && <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400" lang="fr">{vehicle}</p>}
          <h2 className="mt-1 text-lg font-medium text-slate-900 dark:text-slate-100">{isAr ? article.titleAr : article.titleFr}</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{isAr ? article.excerptAr : article.excerptFr}</p>
          <p className="mt-auto pt-3 text-xs text-slate-500 dark:text-slate-400">
            {article.publishedAt && (
              <time dateTime={article.publishedAt.toISOString()}>{dateFormatter.format(article.publishedAt)}</time>
            )}
          </p>
        </div>
      </Link>
    </article>
  );
}

// Champs à sélectionner pour afficher une GuideCard.
export const guideCardSelect = {
  id: true,
  slug: true,
  titleFr: true,
  titleAr: true,
  excerptFr: true,
  excerptAr: true,
  publishedAt: true,
  coverImageUrl: true,
  guide: { select: { brand: { select: { name: true } }, model: { select: { name: true } } } },
} as const;
