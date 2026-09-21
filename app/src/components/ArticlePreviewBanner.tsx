import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { ArticlePreview } from "@/lib/article-preview";

// Lot 145 — bandeau de l'aperçu d'un contenu non publié (src/lib/article-preview.ts). Dit clairement que ce que l'on voit n'est PAS
// public, pourquoi, et mène à la modification. Affiché en tête de la page de l'article, jamais aux visiteurs.
export async function ArticlePreviewBanner({ preview, editHref }: { preview: ArticlePreview; editHref: string }) {
  const locale = await getLocale();
  const t = await getTranslations("ArticlePreview");
  const dateFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "long", timeStyle: "short" });
  const reviewUntil = preview.reviewLink ? dateFormat.format(preview.reviewLink.expiresAt) : null;
  const when = preview.scheduledFor
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "long", timeStyle: "short" }).format(preview.scheduledFor)
    : null;

  return (
    // `data-article-preview` : la marque du bandeau lui-même. Le texte du bandeau, lui, figure dans le dictionnaire envoyé au navigateur avec
    // TOUTES les pages : on ne peut donc pas s'en servir pour savoir si un bandeau est là (les tests cherchent cet attribut).
    <div role="status" data-article-preview={preview.status} className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      {reviewUntil ? (
        // Un relecteur (lien de relecture) : lecture seule, jamais de lien « Modifier », et la date d'expiration du lien.
        <p>
          <strong className="font-semibold">{t("reviewLabel")}</strong> — {t("reviewNotice", { date: reviewUntil })}
        </p>
      ) : (
        <>
          <p>
            <strong className="font-semibold">{t("label")}</strong> — {preview.status === "scheduled" && when ? t("scheduled", { date: when }) : t("draft")}
          </p>
          <Link href={editHref} className="font-medium underline hover:text-amber-800">
            {t("edit")}
          </Link>
        </>
      )}
    </div>
  );
}
