import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { hostLabel } from "@/lib/press-review";

export type PressReviewCardItem = {
  id: string;
  sourceName: string;
  url: string;
  title: string;
  sourcePublishedAt: Date | null;
  noteFr: string;
  noteAr: string;
  brand: { name: string; slug: string } | null;
  model: { name: string; slug: string } | null;
};

// Lot 114 — une entrée de la revue de presse : un lien vers l'essai d'un autre
// média (jamais son texte) et la phrase de la rédaction. Le titre est celui du
// média, dans sa langue : `dir="auto"` évite de le mettre à l'envers dans une
// page arabe (ou l'inverse).
export async function PressReviewCard({ item, locale }: { item: PressReviewCardItem; locale: string }) {
  const t = await getTranslations("PressReview");
  const isAr = locale === "ar";
  const dateFormatter = new Intl.DateTimeFormat(isAr ? "ar-DZ" : "fr-DZ", { dateStyle: "long" });
  const vehicle = [item.brand?.name, item.model?.name].filter(Boolean).join(" ");

  return (
    <article className="flex flex-col rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {item.sourceName}
        {item.sourcePublishedAt && (
          <span className="font-normal normal-case tracking-normal">
            {" · "}
            {dateFormatter.format(item.sourcePublishedAt)}
          </span>
        )}
      </p>
      <h3 className="mt-1 text-base font-medium text-slate-900" dir="auto">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="underline decoration-slate-300 underline-offset-2 hover:decoration-slate-700"
        >
          {item.title}
        </a>
        <span className="sr-only"> {t("opensInNewTab")}</span>
      </h3>
      <p className="mt-2 text-sm text-slate-600">{isAr ? item.noteAr : item.noteFr}</p>
      <p className="mt-auto pt-3 text-xs text-slate-500">
        {t("readOn", { source: hostLabel(item.url) })}
        {vehicle && item.brand && item.model && (
          <>
            {" · "}
            <Link
              href={`/voitures/${item.brand.slug}/${item.model.slug}`}
              className="underline hover:text-slate-700"
            >
              {vehicle}
            </Link>
          </>
        )}
      </p>
    </article>
  );
}
