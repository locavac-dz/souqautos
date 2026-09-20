"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { StepShell } from "@/components/wizard/StepShell";
import { useWizard } from "@/components/wizard/WizardContext";

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
    <StepShell step={5} title={t("step5Title")} nextLabel={t("next")} onNext={handleNext}>
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1">{t("price")}</span>
        <input
          type="number"
          min={1}
          value={data.price ?? ""}
          onChange={(e) => setData({ price: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </StepShell>
  );
}
