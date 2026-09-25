import { getTranslations } from "next-intl/server";
import type { PhotoCredit } from "@/lib/photo-credit";

// Lot 125 — crédit des photos publiées sous licence libre (auteur, licence, source), exigé par les
// licences CC BY et CC BY-SA. Rien n'est affiché pour les photos envoyées par les vendeurs.
export async function PhotoCredits({ credits }: { credits: PhotoCredit[] }) {
  if (credits.length === 0) return null;
  const t = await getTranslations("Listing");
  const linkClass = "underline hover:text-slate-700 dark:hover:text-slate-200";

  return (
    <div className="-mt-3 mb-6 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
      <p>{t("photoIllustrative")}</p>
      {credits.map((credit) => (
        <p key={`${credit.author}|${credit.license}|${credit.sourceUrl ?? ""}`}>
          {t("photoBy")} {credit.author} ·{" "}
          {credit.licenseUrl ? (
            <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer license" className={linkClass}>
              {credit.license}
            </a>
          ) : (
            credit.license
          )}
          {credit.sourceUrl && (
            <>
              {" "}
              ·{" "}
              <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {t("photoSource")}
              </a>
            </>
          )}
        </p>
      ))}
    </div>
  );
}
