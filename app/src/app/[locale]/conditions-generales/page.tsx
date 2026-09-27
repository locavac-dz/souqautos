import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/site";
import { localizedAlternates } from "@/lib/seo-alternates";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Terms" });
  const canonical = `${SITE_URL}/${locale}/conditions-generales`;
  return {
    title: `${t("title")} — Souq Auto`,
    alternates: localizedAlternates(canonical),
    openGraph: { title: t("title"), url: canonical, type: "website" },
  };
}

// Conditions générales d'utilisation et de vente — dernier chantier de
// conformité identifié au Lot 66 (mentions légales Lot 52, politique de
// confidentialité Lot 65 déjà livrées). Même discipline anti-fabrication :
// chaque clause décrit un comportement réel du code (statuts de compte,
// modération, paiement des formules Premium/Premium+ Lot 66, suppression de
// compte Lot 51...), jamais une clause générique copiée d'un modèle. Les
// points sans réponse communiquée à ce jour (juridiction compétente, contact)
// restent honnêtement marqués « à compléter/à confirmer », comme les deux
// autres pages légales.
export default async function TermsPage() {
  const t = await getTranslations("Terms");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{t("title")}</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-8">{t("intro")}</p>

      <div className="space-y-8 text-sm text-slate-700 dark:text-slate-300">
        <section>
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-2">{t("objectTitle")}</h2>
          <p>
            {t("objectBody")}{" "}
            <Link href="/mentions-legales" className="underline hover:text-slate-900 dark:hover:text-slate-100">
              {t("objectLink")}
            </Link>
          </p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-2">{t("acceptanceTitle")}</h2>
          <p>{t("acceptanceBody")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-2">{t("accountTitle")}</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>{t("accountCapacity")}</li>
            <li>{t("accountAccuracy")}</li>
            <li>{t("accountCredentials")}</li>
            <li>{t("accountStatuses")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-2">{t("listingsTitle")}</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>{t("listingsOwnership")}</li>
            <li>{t("listingsAccuracy")}</li>
            <li>{t("listingsProhibited")}</li>
            <li>{t("listingsModeration")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-2">{t("sanctionsTitle")}</h2>
          <p>{t("sanctionsBody")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-2">{t("transactionTitle")}</h2>
          <p>{t("transactionBody")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-2">{t("paidServicesTitle")}</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>{t("paidServicesNature")}</li>
            <li>{t("paidServicesPayment")}</li>
            <li>{t("paidServicesRejection")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-2">{t("reviewsTitle")}</h2>
          <p>{t("reviewsBody")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-2">{t("ownerReviewsTitle")}</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>{t("ownerReviewsDeclared")}</li>
            <li>{t("ownerReviewsContent")}</li>
            <li>{t("ownerReviewsModeration")}</li>
            <li>{t("ownerReviewsData")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-2">{t("terminationTitle")}</h2>
          <p>{t("terminationBody")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-2">{t("ipTitle")}</h2>
          <p>{t("ipPlatformBody")}</p>
          <p className="mt-1.5">{t("ipUserContentBody")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-2">{t("liabilityTitle")}</h2>
          <p>{t("liabilityBody")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-2">{t("lawTitle")}</h2>
          <p>{t("lawBody")}</p>
          <p className="mt-1.5 text-slate-500 dark:text-slate-400">{t("lawPending")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-2">{t("contactTitle")}</h2>
          <p className="text-slate-500 dark:text-slate-400">{t("contactPending")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-2">{t("updatesTitle")}</h2>
          <p>{t("updatesBody")}</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{t("lastUpdated")}</p>
        </section>
      </div>
    </div>
  );
}
