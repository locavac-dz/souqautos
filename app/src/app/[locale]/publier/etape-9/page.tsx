"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { StepShell } from "@/components/wizard/StepShell";
import { useWizard } from "@/components/wizard/WizardContext";

const CATEGORY_KEY: Record<string, string> = {
  VOITURE: "categoryVoiture",
  UTILITAIRE: "categoryUtilitaire",
  POIDS_LOURD: "categoryPoidsLourd",
  DEUX_ROUES: "categoryDeuxRoues",
  AUTRE: "categoryAutre",
};
const FUEL_KEY: Record<string, string> = {
  ESSENCE: "fuelEssence",
  DIESEL: "fuelDiesel",
  GPL: "fuelGpl",
  HYBRIDE: "fuelHybride",
  ELECTRIQUE: "fuelElectrique",
};
const GEARBOX_KEY: Record<string, string> = {
  MANUELLE: "gearboxManuelle",
  AUTOMATIQUE: "gearboxAutomatique",
};
const BODY_TYPE_KEY: Record<string, string> = {
  BERLINE: "bodyTypeBerline",
  SUV: "bodyTypeSuv",
  BREAK: "bodyTypeBreak",
  CITADINE: "bodyTypeCitadine",
  COUPE: "bodyTypeCoupe",
  CABRIOLET: "bodyTypeCabriolet",
  MONOSPACE: "bodyTypeMonospace",
  PICKUP: "bodyTypePickup",
  FOURGON: "bodyTypeFourgon",
};
const CONDITION_KEY: Record<string, string> = {
  NEUF: "conditionNeuf",
  OCCASION: "conditionOccasion",
};

export default function Step9Page() {
  const t = useTranslations("Wizard");
  const { data, photos } = useWizard();

  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);

  const brandLabel = data.brandName ?? data.brandFreeText ?? "—";
  const modelLabel = data.modelName ?? data.modelFreeText ?? "—";

  return (
    <StepShell step={9} title={t("step9Title")} nextLabel={t("next")}>
      <p className="text-sm text-slate-500">{t("previewNote")}</p>

      {previews.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {previews.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              className="aspect-square w-full rounded-md object-cover border border-slate-200"
            />
          ))}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 text-sm">
        <Row label={t("title")} value={data.title} />
        {data.category && <Row label={t("category")} value={t(CATEGORY_KEY[data.category])} />}
        <Row label={t("brand")} value={brandLabel} />
        <Row label={t("model")} value={modelLabel} />
        {data.generationName && <Row label={t("generation")} value={data.generationName} />}
        <Row label={t("year")} value={data.year?.toString()} />
        <Row label={t("mileage")} value={data.mileage ? `${data.mileage} km` : undefined} />
        {data.fuelType && <Row label={t("fuelType")} value={t(FUEL_KEY[data.fuelType])} />}
        {data.gearbox && <Row label={t("gearbox")} value={t(GEARBOX_KEY[data.gearbox])} />}
        {data.condition && <Row label={t("condition")} value={t(CONDITION_KEY[data.condition])} />}
        {data.powerHp && <Row label={t("powerHp")} value={`${data.powerHp} ch`} />}
        {data.fiscalPower && <Row label={t("fiscalPower")} value={`${data.fiscalPower} CV`} />}
        {data.bodyType && <Row label={t("bodyType")} value={t(BODY_TYPE_KEY[data.bodyType])} />}
        {data.negotiable && <Row label={t("negotiable")} value="✓" />}
        {data.controltechniqueExpiry && (
          <Row
            label={t("controltechniqueExpiry")}
            value={new Date(data.controltechniqueExpiry + "T00:00:00").toLocaleDateString("fr-DZ", { dateStyle: "long" })}
          />
        )}
        {data.assuranceExpiry && (
          <Row
            label={t("assuranceExpiry")}
            value={new Date(data.assuranceExpiry + "T00:00:00").toLocaleDateString("fr-DZ", { dateStyle: "long" })}
          />
        )}
        <Row label={t("price")} value={data.price ? `${data.price.toLocaleString()} DA` : undefined} />
        <Row label={t("wilaya")} value={data.wilayaName} />
        {data.communeName && <Row label={t("commune")} value={data.communeName} />}
      </div>

      {data.description && (
        <div>
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("description")}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{data.description}</p>
        </div>
      )}
    </StepShell>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="px-4 py-2.5 flex justify-between gap-4">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-slate-900 dark:text-slate-100 font-medium text-right">{value}</span>
    </div>
  );
}
