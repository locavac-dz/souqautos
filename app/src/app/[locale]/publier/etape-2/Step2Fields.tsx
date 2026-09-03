"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { StepShell } from "@/components/wizard/StepShell";
import { useWizard } from "@/components/wizard/WizardContext";
import type { ListingCategory } from "@prisma/client";

type ModelRow = { id: number; slug: string; name: string; brandId: number };
type BrandRow = { id: number; slug: string; name: string; models: ModelRow[] };

const CATEGORIES: ListingCategory[] = [
  "VOITURE",
  "UTILITAIRE",
  "POIDS_LOURD",
  "DEUX_ROUES",
  "AUTRE",
];

const CATEGORY_KEY: Record<ListingCategory, string> = {
  VOITURE: "categoryVoiture",
  UTILITAIRE: "categoryUtilitaire",
  POIDS_LOURD: "categoryPoidsLourd",
  DEUX_ROUES: "categoryDeuxRoues",
  AUTRE: "categoryAutre",
};

export function Step2Fields({ brands }: { brands: BrandRow[] }) {
  const t = useTranslations("Wizard");
  const { data, setData } = useWizard();
  const [brandOther, setBrandOther] = useState(!data.brandId && Boolean(data.brandFreeText));
  const [modelOther, setModelOther] = useState(!data.modelId && Boolean(data.modelFreeText));
  const [error, setError] = useState<string | null>(null);

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === data.brandId) ?? null,
    [brands, data.brandId]
  );

  function handleNext() {
    if (!data.category) {
      setError(t("errorValidation"));
      return false;
    }
    if (!data.brandId && !(brandOther && data.brandFreeText?.trim())) {
      setError(t("errorValidation"));
      return false;
    }
    setError(null);
    return true;
  }

  return (
    <StepShell step={2} title={t("step2Title")} nextLabel={t("next")} onNext={handleNext}>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{t("category")}</label>
        <select
          value={data.category ?? ""}
          onChange={(e) => setData({ category: e.target.value as ListingCategory })}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
        >
          <option value="" disabled>
            —
          </option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(CATEGORY_KEY[c])}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{t("brand")}</label>
        <select
          value={brandOther ? "__other__" : (data.brandId ?? "")}
          onChange={(e) => {
            if (e.target.value === "__other__") {
              setBrandOther(true);
              setModelOther(true);
              setData({ brandId: undefined, brandName: undefined, modelId: undefined, modelName: undefined });
              return;
            }
            setBrandOther(false);
            setModelOther(false);
            const brand = brands.find((b) => b.id === Number(e.target.value));
            setData({
              brandId: brand?.id,
              brandName: brand?.name,
              brandFreeText: undefined,
              modelId: undefined,
              modelName: undefined,
              modelFreeText: undefined,
            });
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
        >
          <option value="" disabled>
            {t("brandPlaceholder")}
          </option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
          <option value="__other__">{t("brandOther")}</option>
        </select>
      </div>

      {brandOther && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t("brandFreeText")}
          </label>
          <input
            type="text"
            value={data.brandFreeText ?? ""}
            onChange={(e) => setData({ brandFreeText: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
      )}

      {!brandOther && selectedBrand && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t("model")}</label>
          <select
            value={modelOther ? "__other__" : (data.modelId ?? "")}
            onChange={(e) => {
              if (e.target.value === "__other__") {
                setModelOther(true);
                setData({ modelId: undefined, modelName: undefined });
                return;
              }
              setModelOther(false);
              const model = selectedBrand.models.find((m) => m.id === Number(e.target.value));
              setData({ modelId: model?.id, modelName: model?.name, modelFreeText: undefined });
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
          >
            <option value="" disabled>
              {t("modelPlaceholder")}
            </option>
            {selectedBrand.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            <option value="__other__">{t("modelOther")}</option>
          </select>
        </div>
      )}

      {(brandOther || modelOther) && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t("modelFreeText")}
          </label>
          <input
            type="text"
            value={data.modelFreeText ?? ""}
            onChange={(e) => setData({ modelFreeText: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </StepShell>
  );
}
