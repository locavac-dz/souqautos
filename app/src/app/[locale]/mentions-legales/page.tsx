import { getTranslations } from "next-intl/server";

export default async function LegalNoticePage() {
  const t = await getTranslations("Legal");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">{t("title")}</h1>

      <div className="space-y-8 text-sm text-slate-700">
        <section>
          <h2 className="text-base font-medium text-slate-900 mb-2">{t("publisherTitle")}</h2>
          <p>{t("publisherName")}</p>
          <p>{t("publisherLegalForm")}</p>
          <p>{t("publisherAddress")}</p>
          <p>{t("publisherCapital")}</p>
          <p>{t("publisherRc")}</p>
          <p>{t("publisherNif")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 mb-2">{t("brandTitle")}</h2>
          <p>{t("brandBody")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 mb-2">{t("hostingTitle")}</h2>
          <p>{t("hostingCountry")}</p>
          <p className="text-slate-500">{t("hostingPending")}</p>
        </section>

        <section>
          <h2 className="text-base font-medium text-slate-900 mb-2">{t("contactTitle")}</h2>
          <p className="text-slate-500">{t("contactPending")}</p>
        </section>
      </div>
    </div>
  );
}
