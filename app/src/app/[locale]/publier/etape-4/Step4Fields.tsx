"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { StepShell } from "@/components/wizard/StepShell";
import { useWizard } from "@/components/wizard/WizardContext";
import type { ListingCondition } from "@prisma/client";

type EquipmentOption = {
  id: number;
  nameFr: string;
  nameAr: string;
  category: string;
};

const CATEGORY_ORDER = ["CONFORT", "SECURITE", "MULTIMEDIA", "EXTERIEUR", "ACCESSOIRE"] as const;
const CATEGORY_KEY: Record<string, string> = {
  CONFORT: "equipmentCategoryConfort",
  SECURITE: "equipmentCategorySecurite",
  MULTIMEDIA: "equipmentCategoryMultimedia",
  EXTERIEUR: "equipmentCategoryExterieur",
  ACCESSOIRE: "equipmentCategoryAccessoire",
};

export function Step4Fields({ equipments }: { equipments: EquipmentOption[] }) {
  const t = useTranslations("Wizard");
  const locale = useLocale();
  const { data, setData } = useWizard();
  const [error, setError] = useState<string | null>(null);

  function handleNext() {
    if (!data.condition) {
      setError(t("errorValidation"));
      return false;
    }
    setError(null);
    return true;
  }

  function toggleEquipment(id: number) {
    const current = data.equipmentIds ?? [];
    const next = current.includes(id) ? current.filter((e) => e !== id) : [...current, id];
    setData({ equipmentIds: next });
  }

  const byCategory = new Map<string, EquipmentOption[]>();
  for (const eq of equipments) {
    const list = byCategory.get(eq.category) ?? [];
    list.push(eq);
    byCategory.set(eq.category, list);
  }

  return (
    <StepShell step={4} title={t("step4Title")} nextLabel={t("next")} onNext={handleNext}>
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("condition")}</span>
        <select
          value={data.condition ?? ""}
          onChange={(e) => setData({ condition: e.target.value as ListingCondition })}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="" disabled>
            —
          </option>
          <option value="NEUF">{t("conditionNeuf")}</option>
          <option value="OCCASION">{t("conditionOccasion")}</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={data.firstHand ?? false}
          onChange={(e) => setData({ firstHand: e.target.checked })}
        />
        {t("firstHand")}
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={data.accidented ?? false}
          onChange={(e) => setData({ accidented: e.target.checked })}
        />
        {t("accidented")}
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={data.negotiable ?? false}
          onChange={(e) => setData({ negotiable: e.target.checked })}
        />
        {t("negotiable")}
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("controltechniqueExpiry")}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">{t("controltechniqueExpiryHint")}</span>
        <input
          type="date"
          value={data.controltechniqueExpiry ?? ""}
          onChange={(e) => setData({ controltechniqueExpiry: e.target.value || undefined })}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("assuranceExpiry")}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">{t("assuranceExpiryHint")}</span>
        <input
          type="date"
          value={data.assuranceExpiry ?? ""}
          onChange={(e) => setData({ assuranceExpiry: e.target.value || undefined })}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
      </label>

      <div>
        <p className="block text-sm font-medium text-slate-700 mb-2">{t("equipmentsTitle")}</p>
        <p className="text-xs text-slate-500 mb-3">{t("equipmentsHelp")}</p>
        <div className="space-y-4">
          {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => (
            <div key={category}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">
                {t(CATEGORY_KEY[category])}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {byCategory.get(category)!.map((eq) => (
                  <label key={eq.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={(data.equipmentIds ?? []).includes(eq.id)}
                      onChange={() => toggleEquipment(eq.id)}
                    />
                    {locale === "ar" ? eq.nameAr : eq.nameFr}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </StepShell>
  );
}
