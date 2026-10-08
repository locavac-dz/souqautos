"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { StepShell } from "@/components/wizard/StepShell";
import { useWizard } from "@/components/wizard/WizardContext";
import type { ListingCategory } from "@prisma/client";
import { filterCatalogueByCategory, LISTING_CATEGORIES, modelInCategory } from "@/lib/vehicle-catalogue";

type GenerationRow = { id: number; name: string; yearStart: number; yearEnd: number | null };
type ModelRow = { id: number; slug: string; name: string; brandId: number; categories: ListingCategory[]; generations: GenerationRow[] };
type BrandRow = { id: number; slug: string; name: string; models: ModelRow[] };

const CATEGORIES = LISTING_CATEGORIES;

const CATEGORY_KEY: Record<ListingCategory, string> = {
  VOITURE: "categoryVoiture",
  UTILITAIRE: "categoryUtilitaire",
  POIDS_LOURD: "categoryPoidsLourd",
  DEUX_ROUES: "categoryDeuxRoues",
  AUTRE: "categoryAutre",
  EQUIPEMENT: "categoryEquipement",
};

export function Step2Fields({ brands }: { brands: BrandRow[] }) {
  const t = useTranslations("Wizard");
  const { data, setData } = useWizard();
  const [brandOtherChoice, setBrandOther] = useState(!data.brandId && Boolean(data.brandFreeText));
  const [modelOtherChoice, setModelOther] = useState(!data.modelId && Boolean(data.modelFreeText));
  const [error, setError] = useState<string | null>(null);
  // Lot 267 (audit B9) — un équipement n'a pas de catalogue : la saisie libre est DÉRIVÉE de la catégorie (y compris
  // quand le brouillon la restaure après le premier rendu), au lieu d'être recopiée dans l'état par un effet
  // (règle react-hooks/set-state-in-effect, qui faisait échouer le lint et la CI).
  const brandOther = data.category === "EQUIPEMENT" || brandOtherChoice;
  const modelOther = data.category === "EQUIPEMENT" || modelOtherChoice;

  // Lot 130 — marques et modèles proposés selon la catégorie choisie (un deux-roues ne propose pas Renault).
  const visibleBrands = useMemo(() => filterCatalogueByCategory(brands, data.category), [brands, data.category]);
  const selectedBrand = useMemo(
    () => visibleBrands.find((b) => b.id === data.brandId) ?? null,
    [visibleBrands, data.brandId]
  );
  const selectedModel = useMemo(
    () => selectedBrand?.models.find((m) => m.id === data.modelId) ?? null,
    [selectedBrand, data.modelId]
  );

  function generationLabel(g: GenerationRow): string {
    return `${g.name} (${g.yearStart}–${g.yearEnd ?? t("generationOngoing")})`;
  }

  function handleNext() {
    if (!data.category) {
      setError(t("errorValidation"));
      return false;
    }
    // La marque est facultative pour les équipements (remorque sans marque connue…)
    if (data.category !== "EQUIPEMENT" && !data.brandId && !(brandOther && data.brandFreeText?.trim())) {
      setError(t("errorValidation"));
      return false;
    }
    setError(null);
    return true;
  }

  return (
    <StepShell step={2} title={t("step2Title")} nextLabel={t("next")} onNext={handleNext} errorMessage={error}>
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("category")}</span>
        <select
          aria-invalid={error ? "true" : undefined}
          value={data.category ?? ""}
          onChange={(e) => {
            const category = e.target.value as ListingCategory;
            // Pour les équipements : pas de catalogue marque/modèle, on force le texte libre.
            if (category === "EQUIPEMENT") {
              setBrandOther(true);
              setModelOther(true);
              setData({ category, brandId: undefined, brandName: undefined, modelId: undefined, modelName: undefined, generationId: undefined, generationName: undefined });
              return;
            }
            // Un choix devenu impossible dans la nouvelle catégorie est effacé, jamais conservé en silence.
            const brand = brands.find((b) => b.id === data.brandId);
            const brandFits = !brand || filterCatalogueByCategory([brand], category).length > 0;
            const model = brand?.models.find((m) => m.id === data.modelId);
            const modelFits = !model || modelInCategory(model, category);
            if (!brandFits) {
              setBrandOther(false);
              setModelOther(false);
              setData({ category, brandId: undefined, brandName: undefined, modelId: undefined, modelName: undefined, generationId: undefined, generationName: undefined });
            } else if (!modelFits) {
              setModelOther(false);
              setData({ category, modelId: undefined, modelName: undefined, generationId: undefined, generationName: undefined });
            } else {
              setData({ category });
            }
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
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
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("brand")}</span>
        <select
          aria-invalid={error ? "true" : undefined}
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
            const brand = visibleBrands.find((b) => b.id === Number(e.target.value));
            setData({
              brandId: brand?.id,
              brandName: brand?.name,
              brandFreeText: undefined,
              modelId: undefined,
              modelName: undefined,
              modelFreeText: undefined,
              generationId: undefined,
              generationName: undefined,
            });
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="" disabled>
            {t("brandPlaceholder")}
          </option>
          {visibleBrands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
          <option value="__other__">{t("brandOther")}</option>
        </select>
      </label>

      {brandOther && (
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t("brandFreeText")}
          </span>
          <input
            type="text"
            value={data.brandFreeText ?? ""}
            onChange={(e) => setData({ brandFreeText: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
        </label>
      )}

      {!brandOther && selectedBrand && (
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("model")}</span>
          <select
            value={modelOther ? "__other__" : (data.modelId ?? "")}
            onChange={(e) => {
              if (e.target.value === "__other__") {
                setModelOther(true);
                setData({ modelId: undefined, modelName: undefined, generationId: undefined, generationName: undefined });
                return;
              }
              setModelOther(false);
              const model = selectedBrand.models.find((m) => m.id === Number(e.target.value));
              setData({
                modelId: model?.id,
                modelName: model?.name,
                modelFreeText: undefined,
                generationId: undefined,
                generationName: undefined,
              });
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
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
        </label>
      )}

      {!brandOther && !modelOther && selectedModel && selectedModel.generations.length > 0 && (
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("generation")}</span>
          <select
            value={data.generationId ?? ""}
            onChange={(e) => {
              const generation = selectedModel.generations.find((g) => g.id === Number(e.target.value));
              setData({
                generationId: generation?.id,
                generationName: generation ? generationLabel(generation) : undefined,
              });
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="">{t("generationPlaceholder")}</option>
            {selectedModel.generations.map((g) => (
              <option key={g.id} value={g.id}>
                {generationLabel(g)}
              </option>
            ))}
          </select>
        </label>
      )}

      {(brandOther || modelOther) && (
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t("modelFreeText")}
          </span>
          <input
            type="text"
            value={data.modelFreeText ?? ""}
            onChange={(e) => setData({ modelFreeText: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
        </label>
      )}

    </StepShell>
  );
}
