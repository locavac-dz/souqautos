import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Politique de confidentialité — ne décrit QUE ce qui existe réellement dans
// le code (cookies, sous-traitants, conservation, sécurité), jamais une
// clause générique copiée d'un modèle. Deux points restent honnêtement
// marqués « à compléter » (autorité de contrôle compétente, adresse de
// contact) faute de décision communiquée à ce jour — même discipline que les
// mentions légales (Lot 52) : jamais une donnée inventée sur un document
// juridique.
export default async function PrivacyPolicyPage() {
  const t = await getTranslations("Privacy");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">{t("title")}</h1>
      <p className="text-sm text-slate-600 mb-8">{t("intro")}</p>

      <div className="space-y-8 text-sm text-slate-700">
        <section>
          <h2 className="text-base font-medium text-slate-900 mb-2">{t("controllerTitle")}</h2>
          <p>
            {t("controllerBody")}{" "}
            <Link href="/mentions-legales" className="underline hover:text-slate-900">
              {t("controllerLink")}
            </Link>
          </p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 mb-2">{t("dataTitle")}</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>{t("dataAccount")}</li>
            <li>{t("dataProfile")}</li>
            <li>{t("dataListings")}</li>
            <li>{t("dataMessaging")}</li>
            <li>{t("dataReviews")}</li>
            <li>{t("dataIdentity")}</li>
            <li>{t("dataUsage")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 mb-2">{t("cookiesTitle")}</h2>
          <p>{t("cookiesBody")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 mb-2">{t("audienceTitle")}</h2>
          <p>{t("audienceBody")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 mb-2">{t("recipientsTitle")}</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>{t("recipientsHosting")}</li>
            <li>{t("recipientsEmail")}</li>
            <li>{t("recipientsSms")}</li>
            <li>{t("recipientsAi")}</li>
            <li>{t("recipientsGoogle")}</li>
          </ul>
          <p className="mt-2">{t("recipientsNever")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 mb-2">{t("retentionTitle")}</h2>
          <p>{t("retentionBody")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 mb-2">{t("securityTitle")}</h2>
          <p>{t("securityBody")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 mb-2">{t("rightsTitle")}</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              {t("rightsAccess")}{" "}
              <Link href="/compte/profil" className="underline hover:text-slate-900">
                {t("rightsLink")}
              </Link>
            </li>
            <li>{t("rightsRectification")}</li>
            <li>{t("rightsErasure")}</li>
            <li>{t("rightsObjection")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 mb-2">{t("complaintTitle")}</h2>
          <p className="text-slate-500">{t("complaintPending")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 mb-2">{t("contactTitle")}</h2>
          <p className="text-slate-500">{t("contactPending")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 mb-2">{t("updatesTitle")}</h2>
          <p>{t("updatesBody")}</p>
          <p className="mt-1 text-slate-500">{t("lastUpdated")}</p>
        </section>
      </div>
    </div>
  );
}
