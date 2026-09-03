"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { StepShell } from "@/components/wizard/StepShell";
import { useWizard } from "@/components/wizard/WizardContext";
import type { ListingCondition } from "@prisma/client";

export default function Step4Page() {
  const t = useTranslations("Wizard");
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

  return (
    <StepShell step={4} title={t("step4Title")} nextLabel={t("next")} onNext={handleNext}>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{t("condition")}</label>
        <select
          value={data.condition ?? ""}
          onChange={(e) => setData({ condition: e.target.value as ListingCondition })}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
        >
          <option value="" disabled>
            —
          </option>
          <option value="NEUF">{t("conditionNeuf")}</option>
          <option value="OCCASION">{t("conditionOccasion")}</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={data.firstHand ?? false}
          onChange={(e) => setData({ firstHand: e.target.checked })}
        />
        {t("firstHand")}
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={data.accidented ?? false}
          onChange={(e) => setData({ accidented: e.target.checked })}
        />
        {t("accidented")}
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </StepShell>
  );
}
