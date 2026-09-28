"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { StepShell } from "@/components/wizard/StepShell";
import { useWizard } from "@/components/wizard/WizardContext";
import { PriceRangeHint } from "@/components/wizard/PriceRangeHint";

export default function Step5Page() {
  const t = useTranslations("Wizard");
  const { data, setData } = useWizard();
  const [error, setError] = useState<string | null>(null);

  function handleNext() {
    if (!data.price || data.price <= 0) {
      setError(t("errorValidation"));
      return false;
    }
    setError(null);
    return true;
  }

  return (
    <StepShell step={5} title={t("step5Title")} nextLabel={t("next")} onNext={handleNext} errorMessage={error}>
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("price")}</span>
        <input
          type="number"
          min={1}
          aria-invalid={error ? "true" : undefined}
          value={data.price ?? ""}
          onChange={(e) => setData({ price: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
      </label>

      {/* Lot 148 — fourchette du marché : visible dès que le modèle et l'année sont renseignés */}
      <PriceRangeHint data={data} price={data.price} />
    </StepShell>
  );
}
